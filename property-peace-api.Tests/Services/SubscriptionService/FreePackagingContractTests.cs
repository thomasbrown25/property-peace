using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Entitlements.Enforcement;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.SubscriptionService;

public sealed class FreePackagingContractTests
{
    private static readonly string[] IncludedCoreFeatures =
    [
        "Up to 5 units",
        "Hosted Property Peace listing page",
        "Lead management and showing scheduling",
        "Digital rental applications",
        "Tenant portal",
        "Maintenance request tracking",
        "Lease management",
        "Basic rent tracking",
        "Expense tracking",
        "Document storage",
    ];

    [Fact]
    public async Task Seeder_PersistsGenuinelyUsefulPermanentFreeContract()
    {
        await using var context = Context();

        await SubscriptionPlanSeeder.SeedSubscriptionPlansAsync(context);

        var free = await context.SubscriptionPlans.SingleAsync(plan => plan.Name == "Free");
        free.IsActive.Should().BeTrue();
        free.IsTrial.Should().BeFalse();
        free.MonthlyPrice.Should().Be(0);
        free.AnnualPrice.Should().Be(0);
        free.MaxProperties.Should().BeNull("the Free limit is total units, not property count");
        free.MaxTotalUnits.Should().Be(5);

        var features = JsonSerializer.Deserialize<string[]>(free.Features!).Should().NotBeNull().And.Subject!;
        features.Should().Contain(IncludedCoreFeatures);
        features.Should().Contain("1 active external listing (coming soon)",
            "external syndication must not be presented as operational yet");
        features.Should().NotContain(feature =>
            feature.Contains("screening", StringComparison.OrdinalIgnoreCase)
            || feature.Contains("e-signature", StringComparison.OrdinalIgnoreCase)
            || feature.Contains("online rent collection", StringComparison.OrdinalIgnoreCase)
            || feature.Contains("SMS", StringComparison.OrdinalIgnoreCase)
            || feature.Contains("Percy", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Seeder_DoesNotPromiseAnUndefinedSupportTier()
    {
        await using var context = Context();

        await SubscriptionPlanSeeder.SeedSubscriptionPlansAsync(context);

        var premium = await context.SubscriptionPlans.SingleAsync(plan => plan.Name == "Premium");
        var features = JsonSerializer.Deserialize<string[]>(premium.Features!).Should().NotBeNull().And.Subject!;
        features.Should().NotContain(feature => feature.Contains("priority support", StringComparison.OrdinalIgnoreCase));
        features.Should().NotContain("Online rent payments (approval required)");
        features.Should().Contain(feature => feature.Contains("Percy", StringComparison.OrdinalIgnoreCase));
        features.Should().Contain(feature => feature.Contains("SMS", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Seeder_RepairsFreePriceAndPackagingEvenWhenLegacyStripeMappingsExist()
    {
        await using var context = Context();
        context.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Name = "Free",
            Description = "legacy trial",
            MaxProperties = 1,
            MaxTotalUnits = 1,
            MonthlyPrice = 9.99m,
            AnnualPrice = 99.99m,
            StripePriceIdMonthly = "price_legacy_monthly",
            StripePriceIdAnnual = "price_legacy_annual",
            Features = "[]",
            IsActive = true,
            IsTrial = true,
        });
        await context.SaveChangesAsync();

        await SubscriptionPlanSeeder.SeedSubscriptionPlansAsync(context);

        var free = await context.SubscriptionPlans.SingleAsync(plan => plan.Name == "Free");
        free.MonthlyPrice.Should().Be(0, "Free must remain $0 regardless of stale paid-price mappings");
        free.AnnualPrice.Should().Be(0, "Free must remain $0 regardless of stale paid-price mappings");
        free.IsTrial.Should().BeFalse("Free is a permanent plan, not a time-limited trial");
        free.MaxProperties.Should().BeNull();
        free.MaxTotalUnits.Should().Be(5);
        JsonSerializer.Deserialize<string[]>(free.Features!).Should().Contain(IncludedCoreFeatures);
    }

    [Fact]
    public void IncludedAcquisitionWorkflows_AreNotHiddenBehindPremiumOrReadinessGates()
    {
        AssertUngated(typeof(ListingController), "CreateListing", "PublishListing");
        AssertUngated(typeof(LeadController), "Pipeline", "Showings", "AddAvailability");
        AssertUngated(typeof(PublicLeadController), "Inquiry", "BrowserBook", "Availability");
        AssertUngated(typeof(ApplicationController), "AddApplication", "SubmitPublicApplication");
    }

    private static void AssertUngated(Type controller, params string[] actions)
    {
        controller.GetCustomAttributes(typeof(RequireEntitlementAttribute), inherit: true).Should().BeEmpty();
        controller.GetCustomAttributes(typeof(RequireFeatureReadyAttribute), inherit: true).Should().BeEmpty();

        foreach (var action in actions)
        {
            var method = controller.GetMethod(action).Should().NotBeNull().And.Subject!;
            method.GetCustomAttributes(typeof(RequireEntitlementAttribute), inherit: true).Should().BeEmpty();
            method.GetCustomAttributes(typeof(RequireFeatureReadyAttribute), inherit: true).Should().BeEmpty();
        }
    }

    private static DataContext Context() => new(
        new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"free-packaging-{Guid.NewGuid()}")
            .Options);
}
