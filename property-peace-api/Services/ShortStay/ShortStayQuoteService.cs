using System.Data;
using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

// Owner-only preflight, never a guest booking endpoint. No writes, holds, payment calls, or checkout token.
public sealed class ShortStayQuoteService(DataContext db, IHttpContextAccessor context, IConfiguration configuration, TimeProvider? clock = null)
{
    public async Task<(int StatusCode, ShortStayQuoteResult? Quote)> Get(long unitId, ShortStayQuoteRequest request, CancellationToken ct)
    {
        var http = context.HttpContext;
        if (http?.User.Identity?.IsAuthenticated != true ||
            http.Items.TryGetValue("OrganizationId", out var org) != true || org is not long orgId || orgId <= 0 ||
            http.Items.TryGetValue("UserId", out var user) != true || user is not long userId || userId <= 0 ||
            !long.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subject) || subject != userId)
            return (403, null);
        if (unitId <= 0 || request.Guests <= 0 || request.CheckOut.DayNumber - request.CheckIn.DayNumber is < 1 or > 30)
            return (400, null);
        // Lock the same unit row as the block/rate/listing and iCal writers before reading
        // inventory. A serializable transaction alone can mix separately fetched generations.
        await using var read = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        if (db.Database.IsSqlServer())
            await db.Database.SqlQueryRaw<long>(
                "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId)
                .SingleOrDefaultAsync(ct);
        var canManage = await db.OrganizationMembers.AsNoTracking().AnyAsync(m => m.OrganizationId == orgId && m.UserId == userId &&
            m.IsActive && m.Organization.IsActive && !m.Organization.IsDeleted &&
            (m.Role == "Owner" || m.Role == "Manager" && m.CanManageProperties), ct);
        if (!canManage) return (403, null);
        var unit = await db.Units.AsNoTracking().Include(u => u.Property).SingleOrDefaultAsync(u => u.Id == unitId &&
            u.Property.OrganizationId == orgId && !u.Property.IsDeleted &&
            (u.OrganizationId == null || u.OrganizationId == orgId), ct);
        if (unit is null) return (404, null);
        if (IanaTimeZoneAttribute.IsValidZone(unit.Property.TimeZoneId))
        {
            var localToday = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime((clock ?? TimeProvider.System).GetUtcNow(),
                TimeZoneInfo.FindSystemTimeZoneById(unit.Property.TimeZoneId!)).DateTime);
            if (request.CheckIn < localToday) return (400, null);
        }
        var listing = await db.ShortStayListings.AsNoTracking().SingleOrDefaultAsync(l => l.UnitId == unitId, ct);
        var rates = await db.ShortStayNightlyRateOverrides.AsNoTracking()
            .Where(r => r.UnitId == unitId && r.Date >= request.CheckIn && r.Date < request.CheckOut)
            .ToDictionaryAsync(r => r.Date, r => r.NightlyRate, ct);
        var owner = await db.ShortStayBlocks.AsNoTracking()
            .Where(b => b.UnitId == unitId && b.StartDate < request.CheckOut && b.EndDate > request.CheckIn)
            .Select(b => new ShortStayOccupiedRange(b.StartDate, b.EndDate, "OwnerBlock")).ToListAsync(ct);
        var subscriptions = await db.ShortStayIcalSubscriptions.AsNoTracking()
            .Where(s => s.UnitId == unitId && s.OrgId == orgId && s.Enabled)
            .Select(s => new { s.LastSuccessAtUtc, s.ConsecutiveFailures, s.FailureCode, s.LastAttemptAtUtc }).ToListAsync(ct);
        var imported = await db.ShortStayIcalOccurrences.AsNoTracking()
            .Where(o => o.Subscription.UnitId == unitId && o.Subscription.OrgId == orgId && o.Subscription.Enabled &&
                o.StartDate < request.CheckOut && o.EndDate > request.CheckIn)
            .Select(o => new ShortStayOccupiedRange(o.StartDate, o.EndDate, "Airbnb")).ToListAsync(ct);
        owner.AddRange(imported);
        var claims = await db.ShortStayOccupancyClaims.AsNoTracking()
            .Where(c => c.UnitId == unitId && c.Reservation.OrganizationId == orgId &&
                c.Date >= request.CheckIn && c.Date < request.CheckOut)
            .Select(c => c.Date).ToListAsync(ct);
        owner.AddRange(claims.Select(date => new ShortStayOccupiedRange(date, date.AddDays(1), "ReservationClaim")));
        var now = (clock ?? TimeProvider.System).GetUtcNow().UtcDateTime;
        // Feed occupancy is informative, not a real-time cross-channel lock. Failed or stale sync cannot prove availability.
        var fresh = subscriptions.Count > 0 && subscriptions.All(s => s.LastSuccessAtUtc.HasValue &&
            s.LastSuccessAtUtc.Value <= now && s.LastSuccessAtUtc.Value >= now.AddHours(-24) &&
            s.ConsecutiveFailures == 0 && s.FailureCode == null &&
            (s.LastAttemptAtUtc == null || s.LastAttemptAtUtc <= s.LastSuccessAtUtc));
        var facts = new ShortStayQuoteFacts(unitId, unit.Property.TimeZoneId ?? "", configuration.GetValue<bool>("ShortStayBooking:Enabled"),
            listing?.Status == ShortStayListingStatus.Published, listing?.NightlyBasePrice ?? 0m,
            listing?.CleaningFee ?? 0m, listing?.MinimumNights ?? 1, listing?.Capacity ?? 0, rates, owner,
            fresh, unit.RentalMode == ERentalMode.ShortTerm, true, listing is not null,
            HasCalendarFeed: subscriptions.Count > 0,
            LodgingTaxRatePercent: listing?.LodgingTaxRatePercent,
            TaxPolicyAttestedAtUtc: listing?.TaxPolicyAttestedAtUtc,
            TaxPolicyAttestedByUserId: listing?.TaxPolicyAttestedByUserId,
            QuoteAsOfUtc: now, WeekendNightlyRate: listing?.WeekendNightlyRate,
            WeeklyDiscountPercent: listing?.WeeklyDiscountPercent ?? 0m,
            MonthlyDiscountPercent: listing?.MonthlyDiscountPercent ?? 0m);
        var result = ShortStayQuoteCalculator.Calculate(request, facts);
        await read.CommitAsync(ct);
        return (200, result);
    }
}
