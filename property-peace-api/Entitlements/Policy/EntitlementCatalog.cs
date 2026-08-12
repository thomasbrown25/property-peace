using System.Collections.ObjectModel;

namespace brownstone_hub_api.Entitlements.Policy;

public static class EntitlementCatalog
{
    public const string Version = "2026-08-10.v1";

    private static readonly IReadOnlySet<PlanKey> KnownPlans = new HashSet<PlanKey>
    {
        PlanKeys.Free,
        PlanKeys.Premium,
        PlanKeys.Lifetime
    };

    public static IReadOnlyList<FeatureEntitlement> Features { get; } =
        Array.AsReadOnly(
        [
            new FeatureEntitlement(
                FeatureKeys.PropertyManagement,
                new OrganizationAuthorityRequirement(
                    OrganizationRole.Manager,
                    OrganizationPermission.ManageProperties),
                [
                    new(PlanKeys.Free, new EntitlementQuota("units", 5)),
                    new(PlanKeys.Premium),
                    new(PlanKeys.Lifetime)
                ],
                [],
                []),
            new FeatureEntitlement(
                FeatureKeys.AdvancedReporting,
                new OrganizationAuthorityRequirement(OrganizationRole.Viewer),
                [new(PlanKeys.Premium), new(PlanKeys.Lifetime)],
                [],
                []),
            new FeatureEntitlement(
                FeatureKeys.DedicatedSmsNumberSetup,
                new OrganizationAuthorityRequirement(OrganizationRole.Manager),
                [new(PlanKeys.Premium), new(PlanKeys.Lifetime)],
                [],
                []),
            new FeatureEntitlement(
                FeatureKeys.SmsMessaging,
                new OrganizationAuthorityRequirement(OrganizationRole.Manager),
                [new(PlanKeys.Premium), new(PlanKeys.Lifetime)],
                [],
                [ReadinessDependencyKeys.SmsNumberConfigured]),
            new FeatureEntitlement(
                FeatureKeys.RentEstimate,
                new OrganizationAuthorityRequirement(OrganizationRole.Viewer),
                [new(PlanKeys.Premium), new(PlanKeys.Lifetime)],
                [],
                []),
            new FeatureEntitlement(
                FeatureKeys.LeaseShieldRead,
                new OrganizationAuthorityRequirement(OrganizationRole.Viewer),
                [new(PlanKeys.Premium), new(PlanKeys.Lifetime)],
                [],
                []),
            new FeatureEntitlement(
                FeatureKeys.LeaseShieldManage,
                new OrganizationAuthorityRequirement(OrganizationRole.Manager),
                [new(PlanKeys.Premium), new(PlanKeys.Lifetime)],
                [],
                [])
        ]);

    public static EntitlementDecision Evaluate(
        FeatureKey feature,
        PlanKey plan,
        EntitlementEvaluationFacts? facts)
    {
        if (!KnownPlans.Contains(plan))
        {
            return Denied(EntitlementReasonCodes.UnknownPolicy);
        }

        var definition = Features.SingleOrDefault(item => item.Key == feature);
        if (definition is null)
        {
            return Denied(EntitlementReasonCodes.UnknownPolicy);
        }

        var planAccess = definition.PlanAccess.SingleOrDefault(item => item.Plan == plan);
        if (planAccess is null)
        {
            return Decision(false, EntitlementReasonCodes.UpgradeRequired, definition);
        }

        if (facts is null)
        {
            return Decision(false, EntitlementReasonCodes.Unavailable, definition, planAccess.Quota);
        }

        if (planAccess.Quota is not null)
        {
            if (!facts.CurrentUsage.HasValue || facts.CurrentUsage.Value < 0)
            {
                return Decision(false, EntitlementReasonCodes.Unavailable, definition, planAccess.Quota);
            }

            if (facts.CurrentUsage.Value >= planAccess.Quota.Limit)
            {
                return Decision(false, EntitlementReasonCodes.Quota, definition, planAccess.Quota);
            }
        }

        if (definition.RequiredAddOns.Count > 0)
        {
            if (facts.ActiveAddOns is null)
            {
                return Decision(false, EntitlementReasonCodes.Unavailable, definition, planAccess.Quota);
            }

            if (definition.RequiredAddOns.Any(required => !facts.ActiveAddOns.Contains(required)))
            {
                return Decision(false, EntitlementReasonCodes.UpgradeRequired, definition, planAccess.Quota);
            }
        }

        if (definition.ReadinessDependencies.Count > 0)
        {
            if (facts.Readiness is null ||
                definition.ReadinessDependencies.Any(required => !facts.Readiness.ContainsKey(required)))
            {
                return Decision(false, EntitlementReasonCodes.Unavailable, definition, planAccess.Quota);
            }

            if (definition.ReadinessDependencies.Any(required => !facts.Readiness[required]))
            {
                return Decision(false, EntitlementReasonCodes.SetupRequired, definition, planAccess.Quota);
            }
        }

        return Decision(true, EntitlementReasonCodes.Allowed, definition, planAccess.Quota);
    }

    private static EntitlementDecision Decision(
        bool isAllowed,
        EntitlementReasonCode reason,
        FeatureEntitlement definition,
        EntitlementQuota? quota = null) =>
        new(
            isAllowed,
            reason,
            quota,
            definition.RequiredAddOns,
            definition.ReadinessDependencies);

    private static EntitlementDecision Denied(EntitlementReasonCode reason) =>
        new(false, reason);
}
