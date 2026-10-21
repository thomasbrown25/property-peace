using brownstone_hub_api.Services.ShortStay;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ShortStay;

public sealed class ShortStayQuoteTests
{
    private static readonly DateOnly Start = new(2026, 3, 7);
    private static ShortStayQuoteFacts Facts(DateOnly? end = null) => new(
        10, "America/New_York", true, true, 125.25m, 20m, 2, 3,
        new Dictionary<DateOnly, decimal> { [Start.AddDays(1)] = 130.50m },
        Array.Empty<ShortStayOccupiedRange>(), true, true, true, true);
    private static ShortStayQuoteFacts Ready() => Facts() with {
        LodgingTaxRatePercent = 10m, TaxPolicyAttestedAtUtc = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
        TaxPolicyAttestedByUserId = 42, QuoteAsOfUtc = new DateTime(2026, 3, 6, 12, 0, 0, DateTimeKind.Utc) };

    [Fact]
    public void Ready_preflight_is_advisory_and_itemized_never_payable()
    {
        var quote = ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 2), Ready());
        Assert.Equal("preflight_available", quote.Status);
        Assert.Null(quote.Reason);
        Assert.Equal(25575, quote.NightlySubtotalCents);
        Assert.Equal(2000, quote.CleaningFeeCents);
        Assert.Equal(2758, quote.TaxCents);
        Assert.Equal(30333, quote.EstimatedTotalCents);
        Assert.Null(quote.TotalCents);
    }

    [Theory]
    [InlineData("feature")]
    [InlineData("published")]
    [InlineData("mode")]
    [InlineData("active")]
    [InlineData("feed")]
    [InlineData("fresh")]
    [InlineData("manual")]
    [InlineData("imported")]
    [InlineData("claim")]
    [InlineData("tax")]
    public void Every_server_owned_prerequisite_fails_closed(string missing)
    {
        var facts = Ready();
        facts = missing switch {
            "feature" => facts with { FeatureEnabled = false },
            "published" => facts with { Published = false },
            "mode" => facts with { ShortTerm = false },
            "active" => facts with { PropertyActive = false },
            "feed" => facts with { HasCalendarFeed = false },
            "fresh" => facts with { CalendarFresh = false },
            "manual" => facts with { Occupied = [new(Start, Start.AddDays(1), "OwnerBlock")] },
            "imported" => facts with { Occupied = [new(Start, Start.AddDays(1), "Imported")] },
            "claim" => facts with { Occupied = [new(Start, Start.AddDays(1), "Claim")] },
            _ => facts with { TaxPolicyAttestedByUserId = null }
        };
        var quote = ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), facts);
        Assert.Equal("checkout_unavailable", quote.Status);
        Assert.NotNull(quote.Reason);
        Assert.Null(quote.TotalCents);
    }

    [Fact]
    public void Preflight_rejects_today_in_property_timezone_and_future_attestation()
    {
        var facts = Ready() with { QuoteAsOfUtc = new DateTime(2026, 3, 7, 2, 0, 0, DateTimeKind.Utc) };
        // March 7 UTC is still March 6 locally in New York.
        Assert.Equal("preflight_available", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), facts).Status);
        var afterLocalMidnight = facts with { QuoteAsOfUtc = new DateTime(2026, 3, 7, 6, 0, 0, DateTimeKind.Utc) };
        var invalid = ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), afterLocalMidnight);
        Assert.Equal("checkout_unavailable", invalid.Status);
        Assert.Equal("invalid_request", invalid.Reason);
        Assert.Null(invalid.EstimatedTotalCents);
        var notYetAttested = facts with { TaxPolicyAttestedAtUtc = facts.QuoteAsOfUtc!.Value.AddMinutes(1) };
        Assert.Equal("tax_configuration_required", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), notYetAttested).Reason);
    }

    [Fact]
    public void Owner_preview_is_a_read_only_authorized_GET_with_no_client_price()
    {
        var type = typeof(brownstone_hub_api.Controllers.ShortStayQuoteController);
        Assert.NotNull(type.GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), true).SingleOrDefault());
        var method = type.GetMethod("Get")!;
        Assert.NotNull(method.GetCustomAttributes(typeof(brownstone_hub_api.Attributes.RequireOrganizationRoleAttribute), true).SingleOrDefault());
        Assert.DoesNotContain(method.GetParameters(), p => p.Name?.Contains("price", StringComparison.OrdinalIgnoreCase) == true || p.ParameterType == typeof(decimal));
        Assert.Single(method.GetCustomAttributes(typeof(Microsoft.AspNetCore.Mvc.HttpGetAttribute), true));
    }

    [Fact]
    public void Local_spring_DST_nights_use_override_and_exact_decimal_cents()
    {
        var result = ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 2), Facts());
        Assert.Equal("checkout_unavailable", result.Status); // no reviewed tax/fee policy
        Assert.Equal(new[] { Start, Start.AddDays(1) }, result.Nights.Select(n => n.Date));
        Assert.Equal(new[] { 12525L, 13050L }, result.Nights.Select(n => n.AmountCents));
        Assert.Equal(25575, result.NightlySubtotalCents);
        Assert.Equal(2000, result.CleaningFeeCents);
        Assert.Null(result.TotalCents);
        Assert.Equal("tax_configuration_required", result.Reason);
    }

    [Fact]
    public void Reviewed_explicit_zero_fees_enable_deterministic_total_without_a_charge()
    {
        var facts = Facts() with { Policy = new(true, 0m, 0m, 0m) };
        var first = ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 2), facts);
        Assert.Equal("checkout_unavailable", first.Status);
        Assert.Equal("tax_configuration_required", first.Reason);
        Assert.Null(first.TotalCents); // a fixed global fee is not a jurisdiction-specific tax policy
        var second = ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 2), facts);
        Assert.Equal(first.TotalCents, second.TotalCents);
        Assert.Equal(first.Nights.ToArray(), second.Nights.ToArray());
    }

    [Theory]
    [InlineData(false, true, "feature_disabled")]
    [InlineData(true, false, "listing_unavailable")]
    public void Closed_feature_or_unpublished_listing_refuses_quote(bool enabled, bool published, string reason)
    {
        var result = ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), Facts() with { FeatureEnabled = enabled, Published = published });
        Assert.Equal("checkout_unavailable", result.Status);
        Assert.Equal(reason, result.Reason);
        Assert.Null(result.TotalCents);
    }

    [Fact]
    public void Owner_and_Airbnb_ranges_block_only_intersecting_half_open_nights()
    {
        foreach (var source in new[] { "OwnerBlock", "Airbnb" })
        {
            var facts = Facts() with { Occupied = new[] { new ShortStayOccupiedRange(Start.AddDays(2), Start.AddDays(3), source) } };
            Assert.Equal("tax_configuration_required", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), facts with { Policy = new(true, 0m, 0m, 0m) }).Reason);
            Assert.Equal("unavailable_nights", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(3), 1), facts).Reason);
        }
    }

    [Fact]
    public void Stale_or_failed_Airbnb_sync_fails_closed_even_without_occurrences()
    {
        Assert.Equal("calendar_unverified", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), Facts() with { CalendarFresh = false }).Reason);
    }

    [Fact]
    public void Fall_DST_is_two_local_dates_not_elapsed_hours()
    {
        var fall = new DateOnly(2026, 10, 31);
        var result = ShortStayQuoteCalculator.Calculate(new(fall, fall.AddDays(2), 1), Facts() with { Overrides = new Dictionary<DateOnly, decimal>() });
        Assert.Equal(new[] { fall, fall.AddDays(1) }, result.Nights.Select(n => n.Date));
    }

    [Fact]
    public void Capacity_minimum_stay_and_range_bounds_reject_invalid_requests()
    {
        Assert.Equal("invalid_request", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 4), Facts()).Reason);
        Assert.Equal("invalid_request", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(1), 1), Facts()).Reason);
        Assert.Equal("invalid_request", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(367), 1), Facts()).Reason);
        Assert.Equal("invalid_request", ShortStayQuoteCalculator.Calculate(new(Start, Start, 1), Facts()).Reason);
    }

    [Fact]
    public void Disabled_checkout_still_shows_owner_price_preview_without_payable_total()
    {
        var result = ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), Facts() with { FeatureEnabled = false });
        Assert.Equal("feature_disabled", result.Reason);
        Assert.Equal(25575, result.NightlySubtotalCents);
        Assert.Null(result.TotalCents);
    }

    [Fact]
    public void Invalid_server_prices_and_unreviewed_policy_never_yield_total()
    {
        Assert.Equal("invalid_pricing", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), Facts() with { BaseRate = 0.001m }).Reason);
        Assert.Equal("invalid_pricing", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), Facts() with { CleaningFee = decimal.MaxValue }).Reason);
        var policy = Facts() with { Policy = new(false, 0m, 0m, 0m) };
        Assert.Equal("tax_configuration_required", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), policy).Reason);
    }

    [Theory]
    [InlineData(0, 0, 27575)]
    [InlineData(7.25, 1999, 29574)]
    public void Attested_listing_rate_produces_itemized_owner_preview_without_payable_checkout(decimal rate, long tax, long estimated)
    {
        var facts = Facts() with { LodgingTaxRatePercent = rate, TaxPolicyAttestedAtUtc = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc), TaxPolicyAttestedByUserId = 42 };
        var result = ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), facts);
        Assert.Equal(tax, result.TaxCents);
        Assert.Equal(estimated, result.EstimatedTotalCents);
        Assert.Null(result.TotalCents);
        Assert.Null(result.GuestFeeCents);
        Assert.Null(result.PlatformFeeCents);
    }

    [Theory]
    [InlineData(null, true, true)]
    [InlineData("5", false, true)]
    [InlineData("5", true, false)]
    [InlineData("-1", true, true)]
    [InlineData("101", true, true)]
    public void Missing_or_invalid_attestation_never_guesses_tax(string? rate, bool timestamp, bool actor)
    {
        var facts = Facts() with { LodgingTaxRatePercent = rate is null ? null : decimal.Parse(rate, System.Globalization.CultureInfo.InvariantCulture),
            TaxPolicyAttestedAtUtc = timestamp ? new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc) : null,
            TaxPolicyAttestedByUserId = actor ? 42 : null };
        var result = ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), facts);
        Assert.Equal("tax_configuration_required", result.Reason);
        Assert.Equal(25575, result.NightlySubtotalCents);
        Assert.Equal(2000, result.CleaningFeeCents);
        Assert.Null(result.TaxCents);
        Assert.Null(result.EstimatedTotalCents);
        Assert.Null(result.TotalCents);
    }

    [Fact]
    public void Half_cent_tax_rounds_away_from_zero_and_invalid_money_never_overflows()
    {
        var facts = Facts() with { BaseRate = 0.01m, CleaningFee = 0m, Overrides = new Dictionary<DateOnly, decimal>(),
            LodgingTaxRatePercent = 25m, TaxPolicyAttestedAtUtc = DateTime.UtcNow, TaxPolicyAttestedByUserId = 42 };
        Assert.Equal(1, ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), facts).TaxCents);
        Assert.Equal("invalid_pricing", ShortStayQuoteCalculator.Calculate(new(Start, Start.AddDays(2), 1), facts with { BaseRate = decimal.MaxValue }).Reason);
    }
}
