using System.Security.Claims;
using System.Data;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ShortStay;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

public sealed class ShortStayInventoryReportService(DataContext db, IHttpContextAccessor context,
    TimeProvider clock, ILogger<ShortStayInventoryReportService> logger)
{
    private static ServiceResponse<ShortStayInventoryReportDto> Error(string message, int status) =>
        ServiceResponse<ShortStayInventoryReportDto>.CreateError(message, statusCode: status, suppressDetailedErrors: true);

    public async Task<ServiceResponse<ShortStayInventoryReportDto>> Get(long unitId, DateOnly start, DateOnly end, CancellationToken ct = default)
    {
        var http = context.HttpContext;
        if (http?.User.Identity?.IsAuthenticated != true ||
            !http.User.IsInRole("Landlord") && !http.User.IsInRole("Admin") ||
            http.Items.TryGetValue("OrganizationId", out var org) != true || org is not long orgId || orgId <= 0 ||
            http.Items.TryGetValue("UserId", out var user) != true || user is not long userId || userId <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId)
            return Error("Forbidden", 403);
        if (unitId <= 0 || end.DayNumber <= start.DayNumber || end.DayNumber - start.DayNumber > 90)
            return Error("Invalid inventory report range", 400);

        try
        {
            // Keep authorization, unit scope, blocks, feed state and rates in one
            // serializable read view. ReadCommitted permits changes between SELECTs;
            // SQLite's serializable transaction also pins the read view under WAL.
            await using var read = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var canManage = await db.OrganizationMembers.AsNoTracking().AnyAsync(m => m.OrganizationId == orgId &&
                m.UserId == userId && m.IsActive && m.Organization.IsActive && !m.Organization.IsDeleted &&
                (m.Role == "Owner" || m.Role == "Manager" && m.CanManageProperties), ct);
            if (!canManage) return Error("Forbidden", 403);
            var unit = await db.Units.AsNoTracking().Where(u => u.Id == unitId &&
                u.Property.OrganizationId == orgId && !u.Property.IsDeleted &&
                (u.OrganizationId == null || u.OrganizationId == orgId))
                .Select(u => new { u.RentalMode, u.Property.TimeZoneId }).SingleOrDefaultAsync(ct);
            if (unit is null) return Error("Unit not found", 404);
            if (unit.RentalMode != ERentalMode.ShortTerm || !IanaTimeZoneAttribute.IsValidZone(unit.TimeZoneId))
                return Error("Unit unavailable for short-stay inventory report", 409);

            var snapshot = clock.GetUtcNow().UtcDateTime;
            var owner = await db.ShortStayBlocks.AsNoTracking()
                .Where(b => b.UnitId == unitId && b.StartDate < end && b.EndDate > start)
                .Select(b => new { b.StartDate, b.EndDate }).ToListAsync(ct);
            var airbnb = await db.ShortStayIcalOccurrences.AsNoTracking()
                .Where(o => o.Subscription.UnitId == unitId && o.Subscription.OrgId == orgId &&
                    o.Subscription.Enabled && o.StartDate < end && o.EndDate > start)
                .Select(o => new { o.StartDate, o.EndDate }).ToListAsync(ct);
            var claims = await db.ShortStayOccupancyClaims.AsNoTracking()
                .Where(c => c.UnitId == unitId && c.Reservation.OrganizationId == orgId &&
                    c.Date >= start && c.Date < end)
                .Select(c => new { c.Date, c.Reservation.Status }).ToListAsync(ct);
            var sub = await db.ShortStayIcalSubscriptions.AsNoTracking()
                .Where(s => s.UnitId == unitId && s.OrgId == orgId)
                .Select(s => new { s.Enabled, s.LastSuccessAtUtc, s.ConsecutiveFailures }).SingleOrDefaultAsync(ct);
            var baseRate = await db.ShortStayListings.AsNoTracking().Where(l => l.UnitId == unitId)
                .Select(l => (decimal?)l.NightlyBasePrice).SingleOrDefaultAsync(ct);
            var overrides = await db.ShortStayNightlyRateOverrides.AsNoTracking()
                .Where(r => r.UnitId == unitId && r.Date >= start && r.Date < end)
                .Select(r => new { r.Date, r.NightlyRate }).ToDictionaryAsync(r => r.Date, r => r.NightlyRate, ct);

            int ownerNights = 0, airbnbNights = 0, overlapNights = 0, blockedNights = 0, pricedNights = 0;
            int heldNights = 0, confirmedNights = 0;
            var total = end.DayNumber - start.DayNumber;
            // DateOnly arithmetic counts property-local nights, including both DST transitions.
            for (var i = 0; i < total; i++)
            {
                var day = start.AddDays(i);
                var manuallyBlocked = owner.Any(b => b.StartDate <= day && day < b.EndDate);
                var importedBlocked = airbnb.Any(b => b.StartDate <= day && day < b.EndDate);
                var claim = claims.FirstOrDefault(c => c.Date == day);
                if (claim is not null)
                {
                    if (claim.Status == ShortStayReservationStatus.Confirmed) confirmedNights++;
                    else heldNights++;
                }
                if (manuallyBlocked) ownerNights++;
                if (importedBlocked) airbnbNights++;
                if (manuallyBlocked && importedBlocked) overlapNights++;
                if (manuallyBlocked || importedBlocked || claim is not null) { blockedNights++; continue; }
                // An orphan override is not a listing and cannot price an unconfigured unit.
                if (baseRate is not null && (overrides.TryGetValue(day, out var rate) ? rate : baseRate.Value) > 0)
                    pricedNights++;
            }
            var status = sub is null || !sub.Enabled ? "disabled" : sub.ConsecutiveFailures > 0 ? "retrying" :
                sub.LastSuccessAtUtc is null ? "never_synced" :
                sub.LastSuccessAtUtc.Value < snapshot.AddHours(-48) ? "stale" : "healthy";
            // A failed or never-successful feed cannot establish current availability either.
            var warning = sub?.Enabled == true && status != "healthy";
            await read.CommitAsync(ct);
            return ServiceResponse<ShortStayInventoryReportDto>.CreateSuccess(new(unitId, unit.TimeZoneId!, start, end,
                snapshot, total, ownerNights, airbnbNights, overlapNights, blockedNights,
                total - blockedNights, pricedNights, total - blockedNights - pricedNights, status, warning,
                HeldNights: heldNights, ConfirmedNights: confirmedNights));
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Short-stay inventory report failed for unit {UnitId}", unitId);
            return Error("Inventory report unavailable", 503);
        }
    }
}
