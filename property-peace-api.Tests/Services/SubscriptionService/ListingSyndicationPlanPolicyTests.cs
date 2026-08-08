using brownstone_hub_api.Services.SubscriptionService;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.SubscriptionService;

public sealed class ListingSyndicationPlanPolicyTests
{
    [Theory]
    [InlineData("Free", "Monthly")]
    [InlineData("Free", "Annual")]
    public void Resolve_GivesFreePlanOneCoreExternalListing(string planName, string billingCycle)
    {
        var entitlement = ListingSyndicationPlanPolicy.Resolve(planName, billingCycle, isActive: true);

        entitlement.CanUseCoreDestinations.Should().BeTrue();
        entitlement.CanUseExtendedDestinations.Should().BeFalse();
        entitlement.MaxActiveExternalListings.Should().Be(1);
    }

    [Theory]
    [InlineData("Premium", "Monthly")]
    [InlineData("Premium", "Annual")]
    [InlineData("Lifetime Plan", "Lifetime")]
    public void Resolve_GivesPremiumAndLifetimeMultipleExternalListings(string planName, string billingCycle)
    {
        var entitlement = ListingSyndicationPlanPolicy.Resolve(planName, billingCycle, isActive: true);

        entitlement.CanUseCoreDestinations.Should().BeTrue();
        entitlement.CanUseExtendedDestinations.Should().BeTrue();
        entitlement.MaxActiveExternalListings.Should().BeNull();
    }

    [Theory]
    [InlineData("Free", "Monthly")]
    [InlineData("Premium", "Monthly")]
    [InlineData("Lifetime Plan", "Lifetime")]
    public void Resolve_DeniesExternalSyndicationForInactiveSubscriptions(string planName, string billingCycle)
    {
        var entitlement = ListingSyndicationPlanPolicy.Resolve(planName, billingCycle, isActive: false);

        entitlement.CanUseCoreDestinations.Should().BeFalse();
        entitlement.CanUseExtendedDestinations.Should().BeFalse();
        entitlement.MaxActiveExternalListings.Should().Be(0);
    }

    [Fact]
    public void Resolve_DeniesUnknownPlans()
    {
        var entitlement = ListingSyndicationPlanPolicy.Resolve("Unknown", "Monthly", isActive: true);

        entitlement.CanUseCoreDestinations.Should().BeFalse();
        entitlement.CanUseExtendedDestinations.Should().BeFalse();
        entitlement.MaxActiveExternalListings.Should().Be(0);
    }
}
