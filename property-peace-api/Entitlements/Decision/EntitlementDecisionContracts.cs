using brownstone_hub_api.Entitlements.Policy;

namespace brownstone_hub_api.Entitlements.Decision;

/// <summary>
/// Supplies all persisted and runtime facts for one explicit user/organization pair.
/// Implementations must not infer or fall back to a current organization.
/// </summary>
public interface IEntitlementDecisionFactsProvider
{
    Task<EntitlementDecisionFacts?> GetFactsAsync(
        string authenticatedUserId,
        long organizationId,
        FeatureKey feature,
        CancellationToken cancellationToken = default);
}

public sealed record OrganizationSubscriptionFacts(
    long OrganizationId,
    string? PersistedPlanName,
    SubscriptionLifecycleFacts? Lifecycle);

public sealed record EntitlementDecisionFacts(
    string AuthenticatedUserId,
    OrganizationAuthorityFacts? Organization,
    OrganizationMembershipFacts? Membership,
    OrganizationSubscriptionFacts? Subscription,
    int? CurrentUsage = null,
    IReadOnlySet<AddOnKey>? ActiveAddOns = null,
    IReadOnlyDictionary<ReadinessDependencyKey, bool>? Readiness = null);

public sealed record EntitlementDecisionRequest(
    string AuthenticatedUserId,
    long OrganizationId,
    FeatureKey Feature,
    int? RequestedQuantity = null,
    long? ResourceOrganizationId = null);

public enum EntitlementDecisionCategory
{
    Unavailable = 0,
    Upgrade = 1,
    Setup = 2,
    Unauthorized = 3,
    Allowed = 4
}

public sealed record UnifiedEntitlementDecision
{
    public UnifiedEntitlementDecision(
        bool isAllowed,
        EntitlementDecisionCategory category,
        string matrixVersion,
        FeatureKey feature,
        PlanKey? effectivePlan,
        EntitlementReasonCode reason,
        EntitlementQuota? quota = null,
        IEnumerable<AddOnKey>? requiredAddOns = null,
        IEnumerable<ReadinessDependencyKey>? readinessDependencies = null,
        IEnumerable<string>? diagnostics = null)
    {
        IsAllowed = isAllowed;
        Category = category;
        MatrixVersion = matrixVersion ?? string.Empty;
        Feature = feature;
        EffectivePlan = effectivePlan;
        Reason = reason;
        Quota = quota;
        RequiredAddOns = Array.AsReadOnly((requiredAddOns ?? []).ToArray());
        ReadinessDependencies = Array.AsReadOnly((readinessDependencies ?? []).ToArray());
        Diagnostics = Array.AsReadOnly((diagnostics ?? []).ToArray());
    }

    public bool IsAllowed { get; }
    public EntitlementDecisionCategory Category { get; }
    public string MatrixVersion { get; }
    public FeatureKey Feature { get; }
    public PlanKey? EffectivePlan { get; }
    public EntitlementReasonCode Reason { get; }
    public EntitlementQuota? Quota { get; }
    public IReadOnlyList<AddOnKey> RequiredAddOns { get; }
    public IReadOnlyList<ReadinessDependencyKey> ReadinessDependencies { get; }
    public IReadOnlyList<string> Diagnostics { get; }
}

public interface IEntitlementDecisionService
{
    Task<UnifiedEntitlementDecision> DecideAsync(
        EntitlementDecisionRequest request,
        CancellationToken cancellationToken = default);
}
