namespace brownstone_hub_api.Dtos.Entitlements;

/// <summary>Public, non-sensitive quota metadata for an entitlement decision.</summary>
public sealed record EntitlementQuotaResponse(string Unit, int Limit);

/// <summary>
/// Stable read-only entitlement decision contract. This contract intentionally excludes
/// decision diagnostics and all organization, membership, and subscription facts.
/// </summary>
public sealed record EntitlementDecisionResponse(
    bool IsAllowed,
    string MatrixVersion,
    string FeatureKey,
    string? EffectivePlan,
    string ReasonCode,
    string Category,
    EntitlementQuotaResponse? Quota,
    IReadOnlyList<string> RequiredAddOns,
    IReadOnlyList<string> ReadinessDependencies);
