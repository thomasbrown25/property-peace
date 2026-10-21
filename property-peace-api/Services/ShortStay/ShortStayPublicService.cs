using System.Data;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.ShortStay;

// Explicit public allowlist: never serialize EF entities, owner drafts, guidebooks, feed credentials or block details.
// The existing property name/description and unit name are owner-private fields, not curated public copy.
public sealed record ShortStayPublicListing(long UnitId, string Title, string? Description, int MaxGuests,
    decimal NightlyBasePrice, decimal CleaningFee, decimal? LodgingTaxRatePercent,
    string TimeZoneId, string? City, string? State, int MinimumNights, bool BookingAvailable,
    string AvailabilityNotice = "Calendar information is advisory and cannot guarantee availability.",
    bool BookingRequestsEnabled = false, decimal? WeekendNightlyRate = null,
    decimal WeeklyDiscountPercent = 0m, decimal MonthlyDiscountPercent = 0m);

public sealed class ShortStayPublicService(DataContext db, IConfiguration configuration, TimeProvider clock)
{
    private Task<Unit?> PublishedUnit(long unitId, CancellationToken ct) =>
        db.Units.AsNoTracking().Include(u => u.Property).SingleOrDefaultAsync(u => u.Id == unitId &&
            u.Property.OrganizationId != null && (u.OrganizationId == null || u.OrganizationId == u.Property.OrganizationId) &&
            !u.Property.IsDeleted && u.Property.Organization != null &&
            u.Property.Organization.IsActive && !u.Property.Organization.IsDeleted &&
            u.RentalMode == ERentalMode.ShortTerm &&
            db.ShortStayListings.Any(l => l.UnitId == u.Id && l.Status == ShortStayListingStatus.Published), ct);

    public async Task<(int StatusCode, ShortStayPublicListing? Listing)> Get(long unitId, CancellationToken ct)
    {
        if (unitId <= 0) return (404, null);
        var unit = await PublishedUnit(unitId, ct);
        if (unit is null || !IanaTimeZoneAttribute.IsValidZone(unit.Property.TimeZoneId)) return (404, null);
        var listing = await db.ShortStayListings.AsNoTracking().SingleAsync(l => l.UnitId == unitId, ct);
        // City/state are withheld unless they are plain geographic labels (no street, URL or contact data).
        static string? SafePlace(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 80 &&
            value.All(c => char.IsLetter(c) || c is ' ' or '-' or '.' or '\'') ? value : null;
        var title = ShortStayPublicCopy.PlainText(listing.PublicTitle);
        var summary = ShortStayPublicCopy.PlainText(listing.PublicSummary);
        // Discovery only: not Stripe eligibility, payout approval, a hold, or a promise of available nights.
        var requestsEnabled = false;
        if (configuration.GetValue<bool>("ShortStayBooking:Enabled") &&
            configuration.GetValue<bool>("ShortStayBooking:PaymentsEnabled") && unit.Property.LandlordId > 0)
        {
            var account = await db.Users.AsNoTracking()
                .Where(u => u.Id == unit.Property.LandlordId && !u.IsDeleted && !u.IsSuspended)
                .Select(u => u.StripeAccountId).SingleOrDefaultAsync(ct);
            requestsEnabled = !string.IsNullOrWhiteSpace(account) && account == account.Trim();
        }
        return (200, new(unitId, title ?? "Short-stay accommodation", summary, listing.Capacity, listing.NightlyBasePrice,
            listing.CleaningFee, listing.LodgingTaxRatePercent, unit.Property.TimeZoneId!,
            SafePlace(unit.Property.City), SafePlace(unit.Property.State), listing.MinimumNights,
            false, BookingRequestsEnabled: requestsEnabled, WeekendNightlyRate: listing.WeekendNightlyRate,
            WeeklyDiscountPercent: listing.WeeklyDiscountPercent,
            MonthlyDiscountPercent: listing.MonthlyDiscountPercent)); // No guaranteed public checkout capability.
    }

    public async Task<(int StatusCode, ShortStayQuoteResult? Quote)> Quote(long unitId, ShortStayQuoteRequest request, CancellationToken ct)
    {
        if (unitId <= 0) return (404, null);
        // Bound work before accessing the database, and treat dates as property-local nights.
        if (request.Guests is < 1 or > 100 || request.CheckOut.DayNumber - request.CheckIn.DayNumber is < 1 or > 30)
            return (400, null);
        await using var read = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        if (db.Database.IsSqlServer())
            await db.Database.SqlQueryRaw<long>(
                "SELECT Id AS Value FROM [property].[Units] WITH (UPDLOCK, HOLDLOCK) WHERE Id = {0}", unitId)
                .SingleOrDefaultAsync(ct);
        var unit = await PublishedUnit(unitId, ct);
        if (unit is null || !IanaTimeZoneAttribute.IsValidZone(unit.Property.TimeZoneId)) return (404, null);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(),
            TimeZoneInfo.FindSystemTimeZoneById(unit.Property.TimeZoneId!)).DateTime);
        var listing = await db.ShortStayListings.AsNoTracking().SingleAsync(l => l.UnitId == unitId, ct);
        if (request.CheckIn <= today || request.Guests > listing.Capacity ||
            request.CheckOut.DayNumber - request.CheckIn.DayNumber < listing.MinimumNights) return (400, null);
        var orgId = unit.Property.OrganizationId!.Value;
        var rates = await db.ShortStayNightlyRateOverrides.AsNoTracking()
            .Where(r => r.UnitId == unitId && r.Date >= request.CheckIn && r.Date < request.CheckOut)
            .ToDictionaryAsync(r => r.Date, r => r.NightlyRate, ct);
        var occupied = await db.ShortStayBlocks.AsNoTracking()
            .Where(b => b.UnitId == unitId && b.StartDate < request.CheckOut && b.EndDate > request.CheckIn)
            .Select(b => new ShortStayOccupiedRange(b.StartDate, b.EndDate, "OwnerBlock")).ToListAsync(ct);
        var subscriptions = await db.ShortStayIcalSubscriptions.AsNoTracking()
            .Where(s => s.UnitId == unitId && s.OrgId == orgId && s.Enabled)
            .Select(s => new { s.LastSuccessAtUtc, s.ConsecutiveFailures, s.FailureCode, s.LastAttemptAtUtc }).ToListAsync(ct);
        occupied.AddRange(await db.ShortStayIcalOccurrences.AsNoTracking()
            .Where(o => o.Subscription.UnitId == unitId && o.Subscription.OrgId == orgId && o.Subscription.Enabled &&
                o.StartDate < request.CheckOut && o.EndDate > request.CheckIn)
            .Select(o => new ShortStayOccupiedRange(o.StartDate, o.EndDate, "Imported")).ToListAsync(ct));
        var claims = await db.ShortStayOccupancyClaims.AsNoTracking()
            .Where(c => c.UnitId == unitId && c.Reservation.OrganizationId == orgId &&
                c.Date >= request.CheckIn && c.Date < request.CheckOut)
            .Select(c => c.Date).ToListAsync(ct);
        occupied.AddRange(claims.Select(date => new ShortStayOccupiedRange(date, date.AddDays(1), "Claim")));
        var now = clock.GetUtcNow().UtcDateTime;
        var fresh = subscriptions.Count > 0 && subscriptions.All(s => s.LastSuccessAtUtc.HasValue &&
            s.LastSuccessAtUtc.Value <= now && s.LastSuccessAtUtc.Value >= now.AddHours(-24) &&
            s.ConsecutiveFailures == 0 && s.FailureCode == null &&
            (s.LastAttemptAtUtc == null || s.LastAttemptAtUtc <= s.LastSuccessAtUtc));
        var quote = ShortStayQuoteCalculator.Calculate(request, new ShortStayQuoteFacts(unitId, unit.Property.TimeZoneId!,
            configuration.GetValue<bool>("ShortStayBooking:Enabled"), true, listing.NightlyBasePrice,
            listing.CleaningFee, listing.MinimumNights, listing.Capacity, rates, occupied,
            fresh, true, true, true, HasCalendarFeed: subscriptions.Count > 0,
            LodgingTaxRatePercent: listing.LodgingTaxRatePercent,
            TaxPolicyAttestedAtUtc: listing.TaxPolicyAttestedAtUtc,
            TaxPolicyAttestedByUserId: listing.TaxPolicyAttestedByUserId, QuoteAsOfUtc: now,
            WeekendNightlyRate: listing.WeekendNightlyRate,
            WeeklyDiscountPercent: listing.WeeklyDiscountPercent,
            MonthlyDiscountPercent: listing.MonthlyDiscountPercent));
        await read.CommitAsync(ct);
        return (200, quote);
    }
}
