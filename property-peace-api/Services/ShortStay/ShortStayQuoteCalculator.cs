using System.Collections.Immutable;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.ShortStay;

// Pure quote snapshot. Inputs must be loaded from server-owned inventory; this is not a reservation or payment authorization.
public sealed record ShortStayQuoteRequest(DateOnly CheckIn, DateOnly CheckOut, int Guests);
public sealed record ShortStayOccupiedRange(DateOnly Start, DateOnly End, string Source);
public sealed record ShortStayFeePolicy(bool LegallyReviewed, decimal Tax, decimal GuestFee, decimal PlatformFee);
public sealed record ShortStayQuoteFacts(
    long UnitId, string TimeZoneId, bool FeatureEnabled, bool Published,
    decimal BaseRate, decimal CleaningFee, int MinimumNights, int Capacity,
    IReadOnlyDictionary<DateOnly, decimal> Overrides, IReadOnlyList<ShortStayOccupiedRange> Occupied,
    bool CalendarFresh, bool ShortTerm, bool PropertyActive, bool ListingExists,
    ShortStayFeePolicy? Policy = null, bool HasCalendarFeed = true,
    decimal? LodgingTaxRatePercent = null, DateTime? TaxPolicyAttestedAtUtc = null, long? TaxPolicyAttestedByUserId = null,
    DateTime? QuoteAsOfUtc = null, decimal? WeekendNightlyRate = null,
    decimal WeeklyDiscountPercent = 0m, decimal MonthlyDiscountPercent = 0m);
public sealed record ShortStayQuotedNight(DateOnly Date, long AmountCents, string Source);
public sealed record ShortStayQuoteResult(
    string Status, string? Reason, long UnitId, string TimeZoneId, DateOnly CheckIn, DateOnly CheckOut,
    ImmutableArray<ShortStayQuotedNight> Nights, long? NightlySubtotalCents, long? CleaningFeeCents,
    long? TaxCents, long? GuestFeeCents, long? PlatformFeeCents, long? TotalCents,
    long? EstimatedTotalCents = null,
    string AvailabilityNotice = "Advisory estimate only; availability is not guaranteed and this is not a payable quote.",
    long? GrossNightlySubtotalCents = null, long? DiscountCents = null,
    string? DiscountType = null, decimal DiscountPercent = 0m);

public static class ShortStayQuoteCalculator
{
    // Rates are bounded to match the persisted nightly override range; arithmetic is checked in integer cents.
    private static bool Cents(decimal value, bool allowZero, out long cents)
    {
        cents = 0;
        if (value < (allowZero ? 0m : 0.01m) || value > 999999.99m || value != decimal.Round(value, 2)) return false;
        cents = decimal.ToInt64(value * 100m);
        return true;
    }

    public static ShortStayQuoteResult Calculate(ShortStayQuoteRequest request, ShortStayQuoteFacts facts)
    {
        ShortStayQuoteResult Unavailable(string reason) => new("checkout_unavailable", reason, facts.UnitId, facts.TimeZoneId,
            request.CheckIn, request.CheckOut, ImmutableArray<ShortStayQuotedNight>.Empty, null, null, null, null, null, null);
        if (!facts.PropertyActive || !facts.ListingExists || !facts.Published || !facts.ShortTerm ||
            !IanaTimeZoneAttribute.IsValidZone(facts.TimeZoneId)) return Unavailable("listing_unavailable");
        if (facts.QuoteAsOfUtc is { } asOf &&
            request.CheckIn <= DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
                DateTime.SpecifyKind(asOf, DateTimeKind.Utc), TimeZoneInfo.FindSystemTimeZoneById(facts.TimeZoneId))))
            return Unavailable("invalid_request");
        int length = request.CheckOut.DayNumber - request.CheckIn.DayNumber;
        if (request.Guests < 1 || facts.Capacity < 1 || request.Guests > facts.Capacity ||
            facts.MinimumNights < 1 || length < facts.MinimumNights || length > 30)
            return Unavailable("invalid_request");
        if (!Cents(facts.BaseRate, false, out var baseCents) || !Cents(facts.CleaningFee, true, out var cleaning) ||
            facts.WeekendNightlyRate is { } weekend && !Cents(weekend, false, out _) ||
            !ValidPercent(facts.WeeklyDiscountPercent) || !ValidPercent(facts.MonthlyDiscountPercent))
            return Unavailable("invalid_pricing");
        static bool ValidPercent(decimal value) => value >= 0m && value < 100m && value == decimal.Round(value, 2);
        var nights = ImmutableArray.CreateBuilder<ShortStayQuotedNight>(length);
        long subtotal = 0;
        for (int i = 0; i < length; i++)
        {
            var date = request.CheckIn.AddDays(i);
            var overridden = facts.Overrides.TryGetValue(date, out var rate);
            if (overridden && !Cents(rate, false, out _)) return Unavailable("invalid_pricing");
            var isWeekend = (date.DayOfWeek is DayOfWeek.Friday or DayOfWeek.Saturday) && facts.WeekendNightlyRate.HasValue;
            var price = overridden ? decimal.ToInt64(rate * 100m) : isWeekend
                ? decimal.ToInt64(facts.WeekendNightlyRate!.Value * 100m) : baseCents;
            subtotal = checked(subtotal + price);
            nights.Add(new(date, price, overridden ? "Override" : isWeekend ? "Weekend" : "Base"));
        }
        var breakdown = nights.MoveToImmutable();
        var gross = subtotal;
        var discountType = length >= 28 && facts.MonthlyDiscountPercent > 0 ? "Monthly" :
            length >= 7 && facts.WeeklyDiscountPercent > 0 ? "Weekly" : null;
        var percent = discountType == "Monthly" ? facts.MonthlyDiscountPercent :
            discountType == "Weekly" ? facts.WeeklyDiscountPercent : 0m;
        var discount = decimal.ToInt64(decimal.Round(gross * percent / 100m, 0, MidpointRounding.AwayFromZero));
        subtotal -= discount;
        // Only the listing's owner-attested tax rate is authoritative. The global fixed fee policy
        // is intentionally ignored. TotalCents remains null: there is no payable checkout yet.
        // Database providers may deserialize a UTC column as DateTimeKind.Unspecified.
        var attested = facts.LodgingTaxRatePercent is >= 0m and <= 100m &&
            facts.TaxPolicyAttestedAtUtc is { Kind: not DateTimeKind.Local } attestedAt &&
            attestedAt <= (facts.QuoteAsOfUtc ?? DateTime.UtcNow) && facts.TaxPolicyAttestedByUserId is > 0;
        long? tax = null;
        long? estimated = null;
        if (attested)
        {
            try
            {
                var taxable = checked(subtotal + cleaning);
                var rounded = decimal.Round(taxable * facts.LodgingTaxRatePercent!.Value / 100m, 0, MidpointRounding.AwayFromZero);
                tax = decimal.ToInt64(rounded);
                estimated = checked(taxable + tax.Value);
            }
            catch (OverflowException) { return Unavailable("invalid_pricing"); }
        }
        var reason = subtotal <= 0 ? "invalid_pricing" :
            !facts.FeatureEnabled ? "feature_disabled" :
            !facts.HasCalendarFeed ? "calendar_feed_missing" :
            !facts.CalendarFresh ? "calendar_unverified" :
            facts.Occupied.Any(b => b.Start < request.CheckOut && b.End > request.CheckIn) ? "unavailable_nights" :
            !attested ? "tax_configuration_required" : null;
        return new(reason is null ? "preflight_available" : "checkout_unavailable", reason, facts.UnitId, facts.TimeZoneId,
            request.CheckIn, request.CheckOut, breakdown, subtotal, cleaning, tax, null, null, null, estimated,
            GrossNightlySubtotalCents: gross, DiscountCents: discount, DiscountType: discountType, DiscountPercent: percent);
    }
}
