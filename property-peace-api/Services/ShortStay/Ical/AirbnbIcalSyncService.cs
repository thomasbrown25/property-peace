using System.Data;
using System.Security.Cryptography;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Security;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay.Ical;

/// <summary>One durable poll iteration. Call from a scheduler with fresh contexts; never hold a DB lock across HTTP.</summary>
public sealed class AirbnbIcalSyncService(
    Func<DataContext> createContext, IAirbnbIcalFetcher fetcher,
    ShortStayIcalSecretProtector protector, TimeProvider clock)
{
    private static readonly TimeSpan LeaseDuration = TimeSpan.FromMinutes(1);
    private sealed record Claim(long Id, long UnitId, long OrgId, long Generation, Guid Token, string EncryptedUrl, string Zone);

    private static bool Eligible(ShortStayIcalSubscription sub) =>
        sub.Enabled && sub.Unit.RentalMode == ERentalMode.ShortTerm &&
        sub.Unit.Property.OrganizationId == sub.OrgId && !sub.Unit.Property.IsDeleted &&
        (sub.Unit.OrganizationId == null || sub.Unit.OrganizationId == sub.OrgId) &&
        IanaTimeZoneAttribute.IsValidZone(sub.Unit.Property.TimeZoneId);

    // Serialize with calendar connect/disable, which also locks the unit row. The unit lock is
    // acquired before reading the subscription, so a concurrent replacement cannot be missed.
    private static async Task LockUnit(DataContext db, long unitId, CancellationToken ct)
    {
        if (db.Database.IsSqlServer())
            await db.Database.SqlQueryRaw<long>(
                "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId).SingleOrDefaultAsync(ct);
    }

    private async Task<Claim?> ClaimDue(CancellationToken ct)
    {
        await using var db = createContext();
        var now = clock.GetUtcNow().UtcDateTime;
        // A candidate is only a hint; re-check all predicates after acquiring the unit lock.
        var candidates = await db.ShortStayIcalSubscriptions.AsNoTracking()
            .Where(s => s.Enabled && s.NextAttemptAtUtc != null && s.NextAttemptAtUtc <= now &&
                (s.LeaseToken == null || s.LeaseExpiresAtUtc <= now))
            .OrderBy(s => s.NextAttemptAtUtc).ThenBy(s => s.Id)
            .Select(s => new { s.Id, s.UnitId }).Take(32).ToListAsync(ct);
        foreach (var candidate in candidates)
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            await LockUnit(db, candidate.UnitId, ct);
            var sub = await db.ShortStayIcalSubscriptions.Include(s => s.Unit).ThenInclude(u => u.Property)
                .SingleOrDefaultAsync(s => s.Id == candidate.Id, ct);
            now = clock.GetUtcNow().UtcDateTime;
            if (sub is not null && Eligible(sub) && sub.NextAttemptAtUtc <= now &&
                (sub.LeaseToken is null || sub.LeaseExpiresAtUtc <= now))
            {
                var token = Guid.NewGuid();
                sub.LeaseToken = token;
                sub.LeaseExpiresAtUtc = now.Add(LeaseDuration);
                sub.LastAttemptAtUtc = now;
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
                return new Claim(sub.Id, sub.UnitId, sub.OrgId, sub.Generation, token,
                    sub.EncryptedUrl, sub.Unit.Property.TimeZoneId!);
            }
            await tx.CommitAsync(ct);
            db.ChangeTracker.Clear();
        }
        return null;
    }

    /// <returns>True if a subscription was claimed, including failed or invalidated fetches.</returns>
    public async Task<bool> RunOneDueAsync(CancellationToken ct = default)
    {
        var claim = await ClaimDue(ct);
        if (claim is null) return false;
        IReadOnlyList<ImportedIcalEvent>? events = null;
        string? failure = null;
        try
        {
            var url = protector.DecryptUrl(claim.EncryptedUrl);
            if (!AirbnbIcalFetcher.IsValidUrl(url)) failure = "invalid_url";
            else
            {
                byte[] bytes;
                try { bytes = await fetcher.FetchAsync(url, ct); }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
                catch { failure = "fetch_failed"; bytes = []; }
                if (failure is null)
                {
                    try { events = AirbnbIcalParser.Parse(bytes, claim.Zone, clock.GetUtcNow()); }
                    catch { failure = "invalid_feed"; }
                }
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (CryptographicException) { failure = "credential_invalid"; }
        // Never persist or log raw exception messages, URLs, or iCal data.
        await using var db = createContext();
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await LockUnit(db, claim.UnitId, ct);
        var sub = await db.ShortStayIcalSubscriptions.Include(s => s.Unit).ThenInclude(u => u.Property)
            .SingleOrDefaultAsync(s => s.Id == claim.Id, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        if (sub is null || sub.Generation != claim.Generation || sub.LeaseToken != claim.Token ||
            sub.LeaseExpiresAtUtc <= now || sub.OrgId != claim.OrgId || !Eligible(sub) ||
            sub.Unit.Property.TimeZoneId != claim.Zone)
            return true; // Lost ownership: do not clear the new owner's lease or touch their status.

        var existing = await db.ShortStayIcalOccurrences.Where(o => o.SubscriptionId == sub.Id).ToListAsync(ct);
        if (failure is null && events is { Count: 0 } && existing.Count > 0) failure = "empty_feed_review";
        if (failure is null && events is { Count: > 0 })
        {
            var first = events.Min(e => e.StartDate);
            var last = events.Max(e => e.EndDate);
            var claimedDates = await db.ShortStayOccupancyClaims.AsNoTracking()
                .Where(c => c.UnitId == claim.UnitId && c.Date >= first && c.Date < last)
                .Select(c => c.Date).ToListAsync(ct);
            if (events.Any(e => claimedDates.Any(date => e.StartDate <= date && date < e.EndDate)))
                failure = "reservation_conflict";
        }
        if (failure is null && events is not null)
        {
            var keyed = events.Select(e => new
            {
                Uid = protector.FingerprintEventIdentity(e.SourceUid, ""),
                Recurrence = protector.FingerprintEventIdentity(e.SourceUid, e.RecurrenceKey ?? ""),
                e.StartDate, e.EndDate
            }).ToList();
            var present = keyed.Select(e => (e.Uid, e.Recurrence)).ToHashSet();
            foreach (var old in existing.Where(o => !present.Contains((o.UidKey, o.RecurrenceKey))))
                db.ShortStayIcalOccurrences.Remove(old);
            var byKey = existing.ToDictionary(o => (o.UidKey, o.RecurrenceKey));
            foreach (var entry in keyed)
            {
                if (byKey.TryGetValue((entry.Uid, entry.Recurrence), out var old))
                {
                    old.StartDate = entry.StartDate;
                    old.EndDate = entry.EndDate;
                }
                else db.ShortStayIcalOccurrences.Add(new ShortStayIcalOccurrence
                {
                    SubscriptionId = sub.Id, UidKey = entry.Uid, RecurrenceKey = entry.Recurrence,
                    StartDate = entry.StartDate, EndDate = entry.EndDate
                });
            }
            sub.LastSuccessAtUtc = now;
            sub.NextAttemptAtUtc = now.AddHours(3);
            sub.FailureCode = null;
            sub.ConsecutiveFailures = 0;
        }
        else
        {
            sub.FailureCode = failure ?? "invalid_feed";
            sub.ConsecutiveFailures = Math.Min(sub.ConsecutiveFailures + 1, 16);
            // Capped exponential retry: 5, 10, 20 ... 180 minutes.
            sub.NextAttemptAtUtc = now.AddMinutes(Math.Min(180, 5 * (1 << Math.Min(sub.ConsecutiveFailures - 1, 6))));
        }
        sub.LeaseToken = null;
        sub.LeaseExpiresAtUtc = null;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return true;
    }
}
