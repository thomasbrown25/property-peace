using System.Data;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ShortStayStripe;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

// Internal-only; provider I/O is outside DB transactions. Uncertain provider results retain claims.
public sealed class ShortStayPendingRecoveryService(DataContext db, IShortStayDirectChargeGateway gateway,
    TimeProvider clock, ShortStayPaymentReconciliationService reconciliation,
    ILogger<ShortStayPendingRecoveryService> logger)
{
    public async Task<int> RunBatchAsync(int limit = 10, CancellationToken ct = default)
    {
        if (limit is < 1 or > 50) throw new ArgumentOutOfRangeException(nameof(limit));
        var cutoff = clock.GetUtcNow();
        var pending = db.ShortStayReservations.AsNoTracking()
            .Where(r => r.Status == ShortStayReservationStatus.PendingPayment);
        // SQLite test provider does not translate DateTimeOffset ordering/comparison.
        var ids = db.Database.ProviderName?.Contains("Sqlite", StringComparison.Ordinal) == true
            ? (await pending.Take(1000).ToListAsync(ct)).Where(r => r.HoldExpiresAtUtc <= cutoff)
                .OrderBy(r => r.HoldExpiresAtUtc).Take(limit).Select(r => r.Id).ToList()
            : await pending.Where(r => r.HoldExpiresAtUtc <= cutoff)
                .OrderBy(r => r.HoldExpiresAtUtc).Select(r => r.Id).Take(limit).ToListAsync(ct);
        var completed = 0;
        foreach (var id in ids)
        {
            try { if (await RecoverAsync(id, ct)) completed++; }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                db.ChangeTracker.Clear();
                logger.LogWarning("Short-stay pending recovery deferred for reservation {ReservationId} ({ErrorType}); claims retained",
                    id, ex.GetType().Name);
            }
        }
        return completed;
    }

    private async Task<bool> RecoverAsync(long id, CancellationToken ct)
    {
        db.ChangeTracker.Clear();
        var preliminary = await db.ShortStayReservations.AsNoTracking().SingleOrDefaultAsync(r => r.Id == id, ct);
        if (preliminary is null || preliminary.Status != ShortStayReservationStatus.PendingPayment ||
            preliminary.HoldExpiresAtUtc > clock.GetUtcNow()) return false;
        // Establish exact claim ownership before contacting the provider, then recheck after I/O.
        if (!await ExactUnderLockAsync(preliminary, ct))
        {
            logger.LogWarning("Short-stay reservation {ReservationId} has changed or has non-exact claims; manual review required", id);
            return false;
        }
        string? intentId = preliminary.StripePaymentIntentId;
        if (intentId is null)
        {
            var found = await gateway.SearchByReservationCodeAsync(preliminary.DestinationStripeAccountId,
                preliminary.PublicCode, ct);
            if (found.Count != 1 || !Matches(preliminary, found[0]))
            {
                logger.LogWarning("Short-stay reservation {ReservationId} requires manual payment review: search returned {Count} results (eventual consistency); claims retained", id, found.Count);
                return false;
            }
            intentId = found[0].PaymentIntentId;
            // Recovery of an orphan binding is a DB-only transaction under the same unit lock.
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            await LockUnit(preliminary.UnitId, ct);
            var current = await db.ShortStayReservations.SingleAsync(r => r.Id == id, ct);
            if (!Same(current, preliminary) || !await ExactClaims(current, ct) ||
                current.StripePaymentIntentId is not null && current.StripePaymentIntentId != intentId ||
                await db.ShortStayReservations.AnyAsync(r => r.Id != id && r.StripePaymentIntentId == intentId, ct)) return false;
            if (current.StripePaymentIntentId is null)
            {
                current.AttachPaymentIntent(intentId, clock.GetUtcNow());
                await db.SaveChangesAsync(ct);
            }
            await tx.CommitAsync(ct);
        }
        var snapshot = await gateway.RetrieveAsync(preliminary.DestinationStripeAccountId, intentId, ct);
        if (!Matches(preliminary, snapshot) || snapshot.PaymentIntentId != intentId || snapshot.ClientSecret is not null)
        {
            logger.LogWarning("Short-stay reservation {ReservationId} provider mismatch; claims retained", id);
            return false;
        }
        var evt = new VerifiedShortStayPaymentEvent(VerifiedShortStayPaymentKind.Succeeded,
            preliminary.DestinationStripeAccountId, intentId, preliminary.PublicCode);
        if (snapshot.Status == "succeeded")
            return (await reconciliation.ReconcileAsync(evt, ct)).StatusCode == 202;
        if (snapshot.Status is not ("requires_payment_method" or "requires_confirmation"))
        {
            logger.LogWarning("Short-stay reservation {ReservationId} payment unresolved ({ProviderStatus}); claims retained", id, snapshot.Status);
            return false;
        }
        if (!await ExactUnderLockAsync(preliminary, ct)) return false;
        // Cancellation is idempotent for the persisted operation. A failed/ambiguous cancel never frees nights.
        // For a second worker, the same key yields the same operation; reconciliation serializes release.
        try { await gateway.CancelAsync(preliminary.DestinationStripeAccountId, intentId,
            $"shortstay:{preliminary.OperationId}:pending-recovery-cancel:v1", ct); }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Short-stay reservation {ReservationId} cancel uncertain ({ErrorType}); claims retained", id, ex.GetType().Name);
        }
        var after = await gateway.RetrieveAsync(preliminary.DestinationStripeAccountId, intentId, ct);
        if (!Matches(preliminary, after) || after.PaymentIntentId != intentId || after.ClientSecret is not null)
            return false;
        if (after.Status == "succeeded") return (await reconciliation.ReconcileAsync(evt, ct)).StatusCode == 202;
        if (after.Status != "canceled") return false;
        return (await reconciliation.ReconcileAsync(evt with { Kind = VerifiedShortStayPaymentKind.Canceled }, ct)).Reason == "failed";
    }

    private async Task<bool> ExactUnderLockAsync(ShortStayReservation preliminary, CancellationToken ct)
    {
        db.ChangeTracker.Clear();
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await LockUnit(preliminary.UnitId, ct);
        var current = await db.ShortStayReservations.AsNoTracking().SingleOrDefaultAsync(r => r.Id == preliminary.Id, ct);
        return current is not null && Same(current, preliminary) && await ExactClaims(current, ct);
    }

    private static bool Same(ShortStayReservation current, ShortStayReservation original) =>
        current.Status == ShortStayReservationStatus.PendingPayment &&
        current.HoldExpiresAtUtc == original.HoldExpiresAtUtc &&
        current.PublicCode == original.PublicCode && current.OperationId == original.OperationId &&
        current.UnitId == original.UnitId && current.PropertyId == original.PropertyId &&
        current.OrganizationId == original.OrganizationId && current.GuestUserId == original.GuestUserId &&
        current.DestinationStripeAccountId == original.DestinationStripeAccountId &&
        current.TotalCents == original.TotalCents && current.Currency == original.Currency &&
        current.CheckInDate == original.CheckInDate && current.CheckOutDate == original.CheckOutDate &&
        (current.StripePaymentIntentId == original.StripePaymentIntentId || original.StripePaymentIntentId is null);

    private async Task<bool> ExactClaims(ShortStayReservation r, CancellationToken ct)
    {
        var claims = await db.ShortStayOccupancyClaims.AsNoTracking().Where(c => c.ReservationId == r.Id).ToListAsync(ct);
        var nights = r.CheckOutDate.DayNumber - r.CheckInDate.DayNumber;
        return nights is >= 1 and <= 30 && claims.Count == nights &&
            claims.All(c => c.UnitId == r.UnitId && c.Date >= r.CheckInDate && c.Date < r.CheckOutDate) &&
            claims.Select(c => c.Date).Distinct().Count() == nights;
    }
    private static bool Matches(ShortStayReservation r, ShortStayIntent i) =>
        !string.IsNullOrWhiteSpace(i.PaymentIntentId) && i.AccountId == r.DestinationStripeAccountId &&
        i.AmountCents == r.TotalCents && i.Currency == r.Currency && i.ReservationCode == r.PublicCode;
    private async Task LockUnit(long id, CancellationToken ct)
    {
        if (db.Database.IsSqlServer())
            await db.Database.SqlQueryRaw<long>(
                "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", id).SingleAsync(ct);
    }
}
