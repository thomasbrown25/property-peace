using brownstone_hub_api.Config;

namespace brownstone_hub_api.Services.FeatureReadiness;

public sealed record FeatureReadinessDto(
    string Feature,
    FeatureReadinessState State,
    bool CanInvoke,
    bool PlanEntitled,
    bool GlobalGateEnabled,
    bool OrganizationReady,
    bool ProviderConfigured,
    bool UserAuthorized,
    IReadOnlyList<string> Blockers);

public static class FeatureReadinessEvaluator
{
    public static FeatureReadinessDto Evaluate(
        string feature,
        FeatureReadinessState state,
        bool planEntitled,
        bool organizationReady,
        bool providerConfigured,
        bool userAuthorized)
    {
        var globalGateEnabled = state is FeatureReadinessState.Available or FeatureReadinessState.Pilot;
        var blockers = new List<string>();
        if (!globalGateEnabled) blockers.Add("GlobalGate");
        if (!planEntitled) blockers.Add("PlanEntitlement");
        if (!organizationReady) blockers.Add("OrganizationReadiness");
        if (!providerConfigured) blockers.Add("ProviderConfiguration");
        if (!userAuthorized) blockers.Add("UserAuthorization");

        return new FeatureReadinessDto(
            feature, state, blockers.Count == 0, planEntitled, globalGateEnabled,
            organizationReady, providerConfigured, userAuthorized, blockers);
    }
}
