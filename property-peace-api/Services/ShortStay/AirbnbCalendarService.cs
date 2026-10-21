using System.Data;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Security;
using brownstone_hub_api.Services.ShortStay.Ical;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

public sealed class AirbnbCalendarService(DataContext db, IHttpContextAccessor context, IConfiguration configuration)
{
    private static ServiceResponse<AirbnbCalendarStatusDto> Error(string message, int status) =>
        ServiceResponse<AirbnbCalendarStatusDto>.CreateError(message, statusCode: status, suppressDetailedErrors: true);

    private (long Org, long User)? Scope()
    {
        var http = context.HttpContext;
        if (http?.User.Identity?.IsAuthenticated != true ||
            http.Items.TryGetValue("OrganizationId", out var org) != true || org is not long organizationId || organizationId <= 0 ||
            http.Items.TryGetValue("UserId", out var user) != true || user is not long userId || userId <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId ||
            !http.User.IsInRole("Landlord") && !http.User.IsInRole("Admin")) return null;
        return (organizationId, userId);
    }

    private Task<bool> CanManage((long Org, long User) scope, CancellationToken ct) =>
        db.OrganizationMembers.AsNoTracking().AnyAsync(m => m.OrganizationId == scope.Org && m.UserId == scope.User &&
            m.IsActive && m.Organization.IsActive && !m.Organization.IsDeleted &&
            (m.Role == "Owner" || m.Role == "Manager" && m.CanManageProperties), ct);

    private Task<Unit?> FindUnit(long id, long org, CancellationToken ct) =>
        db.Units.Include(u => u.Property).FirstOrDefaultAsync(u => u.Id == id &&
            u.Property.OrganizationId == org && !u.Property.IsDeleted &&
            (u.OrganizationId == null || u.OrganizationId == org), ct);

    private static int UnitStatus(Unit? unit) => unit is null ? 404 :
        unit.RentalMode != ERentalMode.ShortTerm || !IanaTimeZoneAttribute.IsValidZone(unit.Property.TimeZoneId) ? 409 : 200;

    private ShortStayIcalSecretProtector? Protector()
    {
        try { return new ShortStayIcalSecretProtector(configuration["ShortStayIcal:EncryptionKey"]); }
        catch (InvalidOperationException) { return null; }
    }

    private static AirbnbCalendarStatusDto Map(long unitId, string zone, ShortStayIcalSubscription? sub, DateTime now)
    {
        var last = sub?.LastSuccessAtUtc;
        var local = last.HasValue ? TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(last.Value, DateTimeKind.Utc),
            TimeZoneInfo.FindSystemTimeZoneById(zone)) : (DateTime?)null;
        var health = sub is null || !sub.Enabled ? "disabled" : sub.ConsecutiveFailures > 0 ? "retrying" :
            last is null ? "never_synced" : last.Value < now.AddHours(-48) ? "stale" : "healthy";
        return new(unitId, sub?.Enabled == true, health, sub?.Generation, zone,
            sub?.LastAttemptAtUtc, last, local, sub?.ConsecutiveFailures ?? 0, sub?.NextAttemptAtUtc);
    }

    public async Task<ServiceResponse<AirbnbCalendarStatusDto>> Get(long unitId, CancellationToken ct = default)
    {
        if (Scope() is not { } scope) return Error("Forbidden", 403);
        if (unitId <= 0) return Error("Invalid unit", 400);
        try
        {
            if (!await CanManage(scope, ct)) return Error("Forbidden", 403);
            var unit = await FindUnit(unitId, scope.Org, ct);
            if (UnitStatus(unit) != 200) return Error("Unit unavailable for Airbnb calendar", UnitStatus(unit));
            if (Protector() is null) return Error("Calendar service unavailable", 503);
            var sub = await db.ShortStayIcalSubscriptions.AsNoTracking().SingleOrDefaultAsync(s => s.UnitId == unitId && s.OrgId == scope.Org, ct);
            return ServiceResponse<AirbnbCalendarStatusDto>.CreateSuccess(Map(unitId, unit!.Property.TimeZoneId!, sub, DateTime.UtcNow));
        }
        catch (OperationCanceledException) { throw; }
        catch { return Error("Calendar service unavailable", 503); } // Never log provider errors containing credentials.
    }

    private async Task<ServiceResponse<AirbnbCalendarStatusDto>> Write(long unitId, string? url, bool refresh, bool disable, CancellationToken ct)
    {
        if (Scope() is not { } scope) return Error("Forbidden", 403);
        if (unitId <= 0) return Error("Invalid unit", 400);
        if (!refresh && !disable && !AirbnbIcalFetcher.IsValidUrl(url)) return Error("Invalid Airbnb calendar URL", 400);
        try
        {
            if (!await CanManage(scope, ct)) return Error("Forbidden", 403);
            // Never begin a mutation without an explicit valid master key.
            var protector = Protector();
            if (protector is null) return Error("Calendar service unavailable", 503);
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (db.Database.IsSqlServer())
                await db.Database.SqlQueryRaw<long>(
                    "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId).SingleOrDefaultAsync(ct);
            var unit = await FindUnit(unitId, scope.Org, ct);
            if (UnitStatus(unit) != 200) return Error("Unit unavailable for Airbnb calendar", UnitStatus(unit));
            var sub = await db.ShortStayIcalSubscriptions.SingleOrDefaultAsync(s => s.UnitId == unitId, ct);
            if (sub is not null && sub.OrgId != scope.Org) return Error("Unit unavailable for Airbnb calendar", 409);
            var now = DateTime.UtcNow;
            if (disable)
            {
                if (sub is not null)
                {
                    if (sub.Enabled || sub.EncryptedUrl.Length > 0 || sub.UrlFingerprint.Length > 0 || sub.LeaseToken is not null)
                        sub.Generation++; // Invalidate any worker that began syncing before disconnect.
                    sub.Enabled = false;
                    sub.EncryptedUrl = string.Empty;
                    sub.UrlFingerprint = string.Empty;
                    sub.NextAttemptAtUtc = null;
                    sub.LeaseToken = null;
                    sub.LeaseExpiresAtUtc = null;
                    // Delete only this feed's imported availability, inside the same transaction as the
                    // generation change. Owner blocks and other units' subscriptions remain untouched.
                    await db.ShortStayIcalOccurrences.Where(o => o.SubscriptionId == sub.Id).ExecuteDeleteAsync(ct);
                }
            }
            else if (refresh)
            {
                if (sub is null || !sub.Enabled) return Error("Calendar not connected", 409);
                // A worker may already be fetching. Retire its claim atomically with the new due time:
                // the old generation cannot commit (or release a newer lease), while another worker
                // can claim the requested refresh immediately. Keep last-good availability intact.
                if (sub.LeaseToken is not null)
                {
                    sub.Generation++;
                    sub.LeaseToken = null;
                    sub.LeaseExpiresAtUtc = null;
                }
                sub.NextAttemptAtUtc = now; // Queue only; network I/O is exclusively the worker's responsibility.
            }
            else
            {
                var fingerprint = protector.FingerprintUrl(url!);
                if (sub is null)
                {
                    sub = new ShortStayIcalSubscription { UnitId = unitId, OrgId = scope.Org,
                        EncryptedUrl = protector.EncryptUrl(url!), UrlFingerprint = fingerprint, NextAttemptAtUtc = now };
                    db.ShortStayIcalSubscriptions.Add(sub);
                }
                else if (!sub.Enabled || !string.Equals(sub.UrlFingerprint, fingerprint, StringComparison.Ordinal))
                {
                    sub.EncryptedUrl = protector.EncryptUrl(url!);
                    sub.UrlFingerprint = fingerprint;
                    sub.Generation++;
                    sub.Enabled = true;
                    sub.LastAttemptAtUtc = null;
                    sub.LastSuccessAtUtc = null;
                    sub.FailureCode = null;
                    sub.ConsecutiveFailures = 0;
                    sub.NextAttemptAtUtc = now;
                    // Prior-generation occurrences are removed atomically on replacement, never served as the new feed.
                    await db.ShortStayIcalOccurrences.Where(o => o.SubscriptionId == sub.Id).ExecuteDeleteAsync(ct);
                }
            }
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return ServiceResponse<AirbnbCalendarStatusDto>.CreateSuccess(Map(unitId, unit!.Property.TimeZoneId!, sub, now));
        }
        catch (OperationCanceledException) { throw; }
        catch { return Error("Calendar service unavailable", 503); }
    }

    public Task<ServiceResponse<AirbnbCalendarStatusDto>> Connect(long unitId, ConnectAirbnbCalendarDto? request, CancellationToken ct = default) =>
        Write(unitId, request?.Url, false, false, ct);
    public Task<ServiceResponse<AirbnbCalendarStatusDto>> Refresh(long unitId, CancellationToken ct = default) =>
        Write(unitId, null, true, false, ct);
    public Task<ServiceResponse<AirbnbCalendarStatusDto>> Disable(long unitId, CancellationToken ct = default) =>
        Write(unitId, null, false, true, ct);
}
