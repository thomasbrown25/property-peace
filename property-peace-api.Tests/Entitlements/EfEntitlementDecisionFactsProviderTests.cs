using brownstone_hub_api.Data;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Infrastructure;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Entitlements;

public sealed class EfEntitlementDecisionFactsProviderTests
{
    [Theory]
    [InlineData("Free", "Active", true, "upgrade-required")]
    [InlineData("Premium", "Active", true, "allowed")]
    [InlineData("Lifetime Plan", "Active", true, "allowed")]
    [InlineData("Premium", "Paused", true, "paused")]
    [InlineData("Premium", "PastDue", true, "expired")]
    [InlineData("Premium", "Expired", true, "expired")]
    [InlineData("Premium", "Active", false, "membership-inactive")]
    public async Task Exact_organization_facts_map_to_advanced_reporting_decision(
        string planName, string status, bool memberActive, string expectedReason)
    {
        await using var db = Db();
        SeedOrganization(db, 10, 42, planName, status, memberActive);
        await db.SaveChangesAsync();

        var service = new EntitlementDecisionService(Provider(db), TimeProvider.System);
        var decision = await service.DecideAsync(new EntitlementDecisionRequest("42", 10, FeatureKeys.AdvancedReporting));

        Assert.Equal(expectedReason, decision.Reason.Value);
        Assert.Equal(expectedReason == "allowed", decision.IsAllowed);
    }

    [Fact]
    public async Task Provider_uses_only_exact_organization_membership_subscription_and_unit_usage_without_fallback()
    {
        await using var db = Db();
        SeedOrganization(db, 10, 42, "Free", "Active", memberActive: true);
        SeedOrganization(db, 20, 42, "Premium", "Active", memberActive: true);
        db.Properties.AddRange(
            new Property { Id = 1, OrganizationId = 10 },
            new Property { Id = 2, OrganizationId = 20 });
        db.Units.AddRange(
            new Unit { Id = 1, PropertyId = 1, OrganizationId = 20 },
            new Unit { Id = 2, PropertyId = 2, OrganizationId = 10 },
            new Unit { Id = 3, PropertyId = 2, OrganizationId = 20 });
        await db.SaveChangesAsync();

        var facts = await Provider(db).GetFactsAsync("42", 10, FeatureKeys.PropertyManagement);

        Assert.NotNull(facts);
        Assert.Equal(10, facts!.Organization!.OrganizationId);
        Assert.Equal(10, facts.Membership!.OrganizationId);
        Assert.Equal(10, facts.Subscription!.OrganizationId);
        Assert.Equal("Free", facts.Subscription.PersistedPlanName);
        Assert.Equal(1, facts.CurrentUsage);
        Assert.NotNull(facts.ActiveAddOns);
        Assert.Empty(facts.ActiveAddOns!);
        Assert.Empty(facts.Readiness!);
    }

    [Fact]
    public async Task Unit_usage_excludes_units_belonging_to_deleted_properties_like_canonical_repository_counts()
    {
        await using var db = Db();
        SeedOrganization(db, 10, 42, "Free", "Active", memberActive: true);
        db.Properties.AddRange(
            new Property { Id = 1, OrganizationId = 10, IsDeleted = false },
            new Property { Id = 2, OrganizationId = 10, IsDeleted = true });
        db.Units.AddRange(
            new Unit { Id = 1, PropertyId = 1, OrganizationId = 10 },
            new Unit { Id = 2, PropertyId = 2, OrganizationId = 10 });
        await db.SaveChangesAsync();

        var facts = await Provider(db).GetFactsAsync("42", 10, FeatureKeys.PropertyManagement);

        Assert.Equal(1, facts!.CurrentUsage);
    }

    [Fact]
    public async Task Advanced_reporting_skips_unit_and_sms_fact_queries()
    {
        await using var db = Db();
        SeedOrganization(db, 10, 42, "Premium", "Active", memberActive: true);
        await db.SaveChangesAsync();
        var loader = new RecordingFeatureFactsLoader();

        var facts = await Provider(db, loader).GetFactsAsync("42", 10, FeatureKeys.AdvancedReporting);

        Assert.NotNull(facts);
        Assert.Equal(0, loader.UnitCountCalls);
        Assert.Equal(0, loader.SmsReadinessCalls);
        Assert.Null(facts!.CurrentUsage);
        Assert.Empty(facts.ActiveAddOns!);
        Assert.Empty(facts.Readiness!);
        Assert.Throws<NotSupportedException>(() =>
            Assert.IsAssignableFrom<ISet<AddOnKey>>(facts.ActiveAddOns).Add(AddOnKeys.SmsMessaging));
        Assert.Throws<NotSupportedException>(() =>
            Assert.IsAssignableFrom<IDictionary<ReadinessDependencyKey, bool>>(facts.Readiness)
                .Add(ReadinessDependencyKeys.SmsNumberConfigured, true));
    }

    [Fact]
    public async Task Sms_loads_only_required_add_on_and_readiness_facts()
    {
        await using var db = Db();
        SeedOrganization(db, 10, 42, "Premium", "Active", memberActive: true);
        await db.SaveChangesAsync();
        var loader = new RecordingFeatureFactsLoader { SmsConfigured = true };

        var facts = await Provider(db, loader).GetFactsAsync("42", 10, FeatureKeys.SmsMessaging);

        Assert.Equal(0, loader.UnitCountCalls);
        Assert.Equal(1, loader.SmsReadinessCalls);
        Assert.Null(facts!.CurrentUsage);
        Assert.Empty(facts.ActiveAddOns!);
        Assert.True(facts.Readiness![ReadinessDependencyKeys.SmsNumberConfigured]);
    }

    [Fact]
    public async Task Wrong_organization_and_admin_without_membership_do_not_fall_back()
    {
        await using var db = Db();
        SeedOrganization(db, 20, 42, "Premium", "Active", memberActive: true);
        db.Organizations.Add(new Organization { Id = 10, Name = "Requested", IsActive = true });
        await db.SaveChangesAsync();

        var service = new EntitlementDecisionService(Provider(db), TimeProvider.System);
        var decision = await service.DecideAsync(new EntitlementDecisionRequest("42", 10, FeatureKeys.AdvancedReporting));

        Assert.False(decision.IsAllowed);
        Assert.Equal("membership-required", decision.Reason.Value);
    }

    [Fact]
    public async Task Deleted_or_inactive_organization_and_inactive_membership_remain_distinguishable()
    {
        await using var db = Db();
        SeedOrganization(db, 10, 42, "Premium", "Active", memberActive: false);
        await db.SaveChangesAsync();
        db.Organizations.Single().IsActive = false;
        db.Organizations.Single().IsDeleted = true;
        await db.SaveChangesAsync();

        var facts = await Provider(db).GetFactsAsync("42", 10, FeatureKeys.AdvancedReporting);

        Assert.NotNull(facts);
        Assert.False(facts!.Organization!.IsActive);
        Assert.True(facts.Organization.IsDeleted);
        Assert.Equal(MembershipState.Inactive, facts.Membership!.State);
    }

    [Theory]
    [InlineData(DateTimeKind.Unspecified)]
    [InlineData(DateTimeKind.Utc)]
    public async Task Persisted_lifecycle_timestamps_are_interpreted_as_utc_with_stable_boundary_decisions(DateTimeKind kind)
    {
        var boundary = new DateTime(2026, 8, 9, 12, 0, 0, kind);
        await using var db = Db();
        SeedOrganization(db, 10, 42, "Premium", "Active", memberActive: true);
        var subscription = db.Subscriptions.Local.Single();
        subscription.CurrentPeriodEnd = boundary;
        subscription.TrialEnd = boundary;
        subscription.CancelledAt = boundary;
        subscription.PausedAt = boundary;
        await db.SaveChangesAsync();

        var facts = await Provider(db).GetFactsAsync("42", 10, FeatureKeys.AdvancedReporting);

        var lifecycle = facts!.Subscription!.Lifecycle!;
        Assert.All(new[] { lifecycle.CurrentPeriodEnd, lifecycle.TrialEnd, lifecycle.CancelledAt, lifecycle.PausedAt },
            value => Assert.Equal(TimeSpan.Zero, value!.Value.Offset));
        var decision = SubscriptionLifecyclePolicy.Evaluate(lifecycle,
            new DateTimeOffset(2026, 8, 9, 12, 0, 0, TimeSpan.Zero));
        Assert.Equal(EntitlementReasonCodes.Expired, decision.Reason);
    }

    [Theory]
    [InlineData("1")]
    [InlineData("2")]
    [InlineData("3")]
    public async Task Numeric_persisted_roles_fail_closed(string role)
    {
        await using var db = Db();
        SeedOrganization(db, 10, 42, "Premium", "Active", memberActive: true);
        db.OrganizationMembers.Local.Single().Role = role;
        await db.SaveChangesAsync();

        var facts = await Provider(db).GetFactsAsync("42", 10, FeatureKeys.AdvancedReporting);
        var decision = OrganizationAuthorityPolicy.Evaluate(
            facts!.Organization!, facts.Membership!,
            new OrganizationAuthorityRequirement(OrganizationRole.Viewer));

        Assert.False(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.UnknownRole, decision.Outcome);
    }

    [Fact]
    public async Task Provider_honors_cancellation()
    {
        await using var db = Db();
        using var source = new CancellationTokenSource();
        source.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => Provider(db).GetFactsAsync("42", 10, FeatureKeys.AdvancedReporting, source.Token));
    }

    private static DataContext Db() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase($"entitlement-facts-{Guid.NewGuid()}", options => options.EnableNullChecks(false))
        .Options);

    private static EfEntitlementDecisionFactsProvider Provider(
        DataContext db, IEntitlementFeatureFactsLoader? loader = null) =>
        new(db, loader ?? new EfEntitlementFeatureFactsLoader(db));

    private static void SeedOrganization(
        DataContext db, long organizationId, long userId, string planName, string status, bool memberActive)
    {
        var planId = organizationId;
        db.Organizations.Add(new Organization { Id = organizationId, Name = $"Org {organizationId}", IsActive = true });
        db.OrganizationMembers.Add(new OrganizationMember
        {
            Id = organizationId,
            OrganizationId = organizationId,
            UserId = userId,
            Role = "Owner",
            IsActive = memberActive
        });
        db.SubscriptionPlans.Add(new SubscriptionPlan { Id = planId, Name = planName });
        db.Subscriptions.Add(new Subscription
        {
            Id = organizationId,
            OrganizationId = organizationId,
            SubscriptionPlanId = planId,
            Status = status
        });
    }

    private sealed class RecordingFeatureFactsLoader : IEntitlementFeatureFactsLoader
    {
        public int UnitCountCalls { get; private set; }
        public int SmsReadinessCalls { get; private set; }
        public bool SmsConfigured { get; init; }

        public Task<int> CountOrganizationUnitsAsync(long organizationId, CancellationToken cancellationToken)
        {
            UnitCountCalls++;
            return Task.FromResult(0);
        }

        public Task<bool> IsSmsNumberConfiguredAsync(long organizationId, CancellationToken cancellationToken)
        {
            SmsReadinessCalls++;
            return Task.FromResult(SmsConfigured);
        }
    }
}
