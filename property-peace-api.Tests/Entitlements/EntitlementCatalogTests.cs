using brownstone_hub_api.Entitlements.Policy;
using Xunit;

namespace brownstone_hub_api.Tests.Entitlements;

public sealed class EntitlementCatalogTests
{
    private static readonly EntitlementEvaluationFacts NoRequirements = new();

    [Fact]
    public void Catalog_has_version_and_unique_feature_keys()
    {
        Assert.Equal("2026-08-10.v1", EntitlementCatalog.Version);
        Assert.NotEmpty(EntitlementCatalog.Features);
        Assert.Equal(
            EntitlementCatalog.Features.Count,
            EntitlementCatalog.Features.Select(feature => feature.Key).Distinct().Count());
    }

    [Fact]
    public void Every_feature_has_one_deterministic_trusted_authority_requirement()
    {
        Assert.All(EntitlementCatalog.Features, feature => Assert.NotNull(feature.AuthorityRequirement));

        Assert.Equal(
            new OrganizationAuthorityRequirement(
                OrganizationRole.Manager,
                OrganizationPermission.ManageProperties),
            EntitlementCatalog.Features.Single(feature => feature.Key == FeatureKeys.PropertyManagement).AuthorityRequirement);
        Assert.Equal(
            new OrganizationAuthorityRequirement(OrganizationRole.Viewer),
            EntitlementCatalog.Features.Single(feature => feature.Key == FeatureKeys.AdvancedReporting).AuthorityRequirement);
        Assert.Equal(
            new OrganizationAuthorityRequirement(OrganizationRole.Manager),
            EntitlementCatalog.Features.Single(feature => feature.Key == FeatureKeys.DedicatedSmsNumberSetup).AuthorityRequirement);
        Assert.Equal(
            new OrganizationAuthorityRequirement(OrganizationRole.Manager),
            EntitlementCatalog.Features.Single(feature => feature.Key == FeatureKeys.SmsMessaging).AuthorityRequirement);
    }

    [Fact]
    public void Finite_quota_with_missing_usage_fails_closed_and_preserves_metadata()
    {
        var decision = EntitlementCatalog.Evaluate(FeatureKeys.PropertyManagement, PlanKeys.Free, NoRequirements);

        Assert.False(decision.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.Unavailable, decision.Reason);
        Assert.Equal(new EntitlementQuota("units", 5), decision.Quota);
        Assert.Empty(decision.RequiredAddOns);
        Assert.Empty(decision.ReadinessDependencies);
    }

    [Theory]
    [InlineData(4, true, "allowed")]
    [InlineData(5, false, "quota")]
    [InlineData(6, false, "quota")]
    public void Finite_quota_is_allowed_below_limit_and_denied_at_or_above_it(
        int usage,
        bool expectedAllowed,
        string expectedReason)
    {
        var decision = EntitlementCatalog.Evaluate(
            FeatureKeys.PropertyManagement,
            PlanKeys.Free,
            new EntitlementEvaluationFacts(CurrentUsage: usage));

        Assert.Equal(expectedAllowed, decision.IsAllowed);
        Assert.Equal(expectedReason, decision.Reason.Value);
        Assert.Equal(new EntitlementQuota("units", 5), decision.Quota);
        Assert.Empty(decision.RequiredAddOns);
        Assert.Empty(decision.ReadinessDependencies);
    }

    [Theory]
    [InlineData("premium")]
    [InlineData("lifetime")]
    public void Unlimited_property_plans_are_not_denied_for_missing_usage(string plan)
    {
        var decision = EntitlementCatalog.Evaluate(
            FeatureKeys.PropertyManagement,
            new PlanKey(plan),
            NoRequirements);

        Assert.True(decision.IsAllowed);
        Assert.Null(decision.Quota);
    }

    [Fact]
    public void Dedicated_number_setup_is_included_for_premium_and_lifetime_without_number_readiness_or_add_on()
    {
        var free = EntitlementCatalog.Evaluate(FeatureKeys.DedicatedSmsNumberSetup, PlanKeys.Free, NoRequirements);
        var premium = EntitlementCatalog.Evaluate(FeatureKeys.DedicatedSmsNumberSetup, PlanKeys.Premium, NoRequirements);
        var lifetime = EntitlementCatalog.Evaluate(FeatureKeys.DedicatedSmsNumberSetup, PlanKeys.Lifetime, NoRequirements);

        Assert.Equal(EntitlementReasonCodes.UpgradeRequired, free.Reason);
        Assert.True(premium.IsAllowed);
        Assert.True(lifetime.IsAllowed);
        Assert.Empty(premium.RequiredAddOns);
        Assert.Empty(premium.ReadinessDependencies);
    }

    [Fact]
    public void Messaging_requires_configured_active_number_but_never_an_add_on()
    {
        var missing = EntitlementCatalog.Evaluate(
            FeatureKeys.SmsMessaging,
            PlanKeys.Premium,
            NoRequirements);
        var unsatisfied = EntitlementCatalog.Evaluate(
            FeatureKeys.SmsMessaging,
            PlanKeys.Premium,
            new EntitlementEvaluationFacts(
                Readiness: new Dictionary<ReadinessDependencyKey, bool>
                {
                    [ReadinessDependencyKeys.SmsNumberConfigured] = false
                }));
        var ready = EntitlementCatalog.Evaluate(
            FeatureKeys.SmsMessaging,
            PlanKeys.Premium,
            new EntitlementEvaluationFacts(
                Readiness: new Dictionary<ReadinessDependencyKey, bool>
                {
                    [ReadinessDependencyKeys.SmsNumberConfigured] = true
                }));

        Assert.False(missing.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.Unavailable, missing.Reason);
        Assert.False(unsatisfied.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.SetupRequired, unsatisfied.Reason);
        Assert.True(ready.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.Allowed, ready.Reason);
        Assert.Empty(ready.RequiredAddOns);
    }

    [Fact]
    public void Plan_without_feature_access_is_upgrade_required_with_diagnostic_metadata()
    {
        var decision = EntitlementCatalog.Evaluate(FeatureKeys.SmsMessaging, PlanKeys.Free, NoRequirements);

        Assert.False(decision.IsAllowed);
        Assert.Equal(EntitlementReasonCodes.UpgradeRequired, decision.Reason);
        Assert.Empty(decision.RequiredAddOns);
        Assert.Equal([ReadinessDependencyKeys.SmsNumberConfigured], decision.ReadinessDependencies);
    }

    [Theory]
    [InlineData("Free", "free")]
    [InlineData("premium", "premium")]
    [InlineData("LIFETIME PLAN", "lifetime")]
    public void Persisted_plan_names_have_one_explicit_case_insensitive_mapping(string persisted, string expected)
    {
        Assert.True(PlanKeyMapping.TryFromPersistedName(persisted, out var plan));
        Assert.Equal(new PlanKey(expected), plan);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Enterprise")]
    [InlineData("Lifetime")]
    public void Unknown_or_missing_persisted_plan_names_fail_closed(string? persisted)
    {
        Assert.False(PlanKeyMapping.TryFromPersistedName(persisted, out var plan));
        Assert.Equal(default, plan);
    }

    [Fact]
    public void Unknown_feature_and_plan_fail_closed_with_normalized_empty_metadata()
    {
        var feature = EntitlementCatalog.Evaluate(new FeatureKey("not-catalogued"), PlanKeys.Lifetime, NoRequirements);
        var plan = EntitlementCatalog.Evaluate(FeatureKeys.PropertyManagement, new PlanKey("enterprise"), NoRequirements);

        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, feature.Reason);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, plan.Reason);
        Assert.False(feature.IsAllowed);
        Assert.False(plan.IsAllowed);
        Assert.NotNull(feature.RequiredAddOns);
        Assert.NotNull(feature.ReadinessDependencies);
        Assert.Empty(feature.RequiredAddOns);
        Assert.Empty(feature.ReadinessDependencies);
    }

    [Fact]
    public void Catalog_and_decision_collections_resist_mutation()
    {
        var features = Assert.IsAssignableFrom<IList<FeatureEntitlement>>(EntitlementCatalog.Features);
        Assert.Throws<NotSupportedException>(() => features.Clear());

        var sms = EntitlementCatalog.Features.Single(item => item.Key == FeatureKeys.SmsMessaging);
        Assert.Throws<NotSupportedException>(() => Assert.IsAssignableFrom<IList<AddOnKey>>(sms.RequiredAddOns).Clear());
        Assert.Throws<NotSupportedException>(() => Assert.IsAssignableFrom<IList<PlanEntitlement>>(sms.PlanAccess).Clear());

        var denied = EntitlementCatalog.Evaluate(new FeatureKey("unknown"), PlanKeys.Free, NoRequirements);
        Assert.Throws<NotSupportedException>(() => Assert.IsAssignableFrom<IList<AddOnKey>>(denied.RequiredAddOns).Clear());
    }

    [Fact]
    public void Feature_entitlement_defensively_copies_constructor_collections()
    {
        var plans = new List<PlanEntitlement> { new(PlanKeys.Free) };
        var addOns = new List<AddOnKey> { AddOnKeys.SmsMessaging };
        var readiness = new List<ReadinessDependencyKey> { ReadinessDependencyKeys.SmsNumberConfigured };
        var feature = new FeatureEntitlement(
            FeatureKeys.SmsMessaging,
            new OrganizationAuthorityRequirement(OrganizationRole.Manager),
            plans,
            addOns,
            readiness);

        plans.Clear();
        addOns.Clear();
        readiness.Clear();

        Assert.Single(feature.PlanAccess);
        Assert.Single(feature.RequiredAddOns);
        Assert.Single(feature.ReadinessDependencies);
    }

    [Fact]
    public void Reason_codes_are_stable_api_owned_values()
    {
        Assert.Equal("allowed", EntitlementReasonCodes.Allowed.Value);
        Assert.Equal("upgrade-required", EntitlementReasonCodes.UpgradeRequired.Value);
        Assert.Equal("setup-required", EntitlementReasonCodes.SetupRequired.Value);
        Assert.Equal("unavailable", EntitlementReasonCodes.Unavailable.Value);
        Assert.Equal("unauthorized", EntitlementReasonCodes.Unauthorized.Value);
        Assert.Equal("paused", EntitlementReasonCodes.Paused.Value);
        Assert.Equal("expired", EntitlementReasonCodes.Expired.Value);
        Assert.Equal("inactive", EntitlementReasonCodes.Inactive.Value);
        Assert.Equal("quota", EntitlementReasonCodes.Quota.Value);
        Assert.Equal("unknown-policy", EntitlementReasonCodes.UnknownPolicy.Value);
    }
}
