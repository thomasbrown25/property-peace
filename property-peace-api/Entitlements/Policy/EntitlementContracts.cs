using System.Collections.ObjectModel;

namespace brownstone_hub_api.Entitlements.Policy;

public readonly record struct FeatureKey(string Value);

public readonly record struct PlanKey(string Value);

public readonly record struct AddOnKey(string Value);

public readonly record struct ReadinessDependencyKey(string Value);

public readonly record struct EntitlementReasonCode(string Value)
{
    public override string ToString() => Value;
}

public static class FeatureKeys
{
    public static readonly FeatureKey PropertyManagement = new("property-management");
    public static readonly FeatureKey AdvancedReporting = new("advanced-reporting");
    public static readonly FeatureKey DedicatedSmsNumberSetup = new("dedicated-sms-number-setup");
    public static readonly FeatureKey SmsMessaging = new("sms-messaging");
    public static readonly FeatureKey RentEstimate = new("rent-estimate");
    public static readonly FeatureKey LeaseShieldRead = new("lease-shield-read");
    public static readonly FeatureKey LeaseShieldManage = new("lease-shield-manage");
}

public static class PlanKeys
{
    public static readonly PlanKey Free = new("free");
    public static readonly PlanKey Premium = new("premium");
    public static readonly PlanKey Lifetime = new("lifetime");
}

/// <summary>Owns the only conversion from persisted subscription plan names to policy keys.</summary>
public static class PlanKeyMapping
{
    public static bool TryFromPersistedName(string? persistedName, out PlanKey plan)
    {
        if (string.Equals(persistedName, "Free", StringComparison.OrdinalIgnoreCase))
        {
            plan = PlanKeys.Free;
            return true;
        }

        if (string.Equals(persistedName, "Premium", StringComparison.OrdinalIgnoreCase))
        {
            plan = PlanKeys.Premium;
            return true;
        }

        if (string.Equals(persistedName, "Lifetime Plan", StringComparison.OrdinalIgnoreCase))
        {
            plan = PlanKeys.Lifetime;
            return true;
        }

        plan = default;
        return false;
    }
}

public static class AddOnKeys
{
    public static readonly AddOnKey SmsMessaging = new("sms-messaging");
}

public static class ReadinessDependencyKeys
{
    public static readonly ReadinessDependencyKey SmsNumberConfigured = new("sms-number-configured");
}

public static class EntitlementReasonCodes
{
    public static readonly EntitlementReasonCode Allowed = new("allowed");
    public static readonly EntitlementReasonCode UpgradeRequired = new("upgrade-required");
    public static readonly EntitlementReasonCode SetupRequired = new("setup-required");
    public static readonly EntitlementReasonCode Unavailable = new("unavailable");
    public static readonly EntitlementReasonCode Unauthorized = new("unauthorized");
    public static readonly EntitlementReasonCode Paused = new("paused");
    public static readonly EntitlementReasonCode Expired = new("expired");
    public static readonly EntitlementReasonCode Inactive = new("inactive");
    public static readonly EntitlementReasonCode Quota = new("quota");
    public static readonly EntitlementReasonCode UnknownPolicy = new("unknown-policy");
    public static readonly EntitlementReasonCode InvalidInput = new("invalid-input");
    public static readonly EntitlementReasonCode OrganizationRequired = new("organization-required");
    public static readonly EntitlementReasonCode OrganizationMismatch = new("organization-mismatch");
    public static readonly EntitlementReasonCode SubjectMismatch = new("subject-mismatch");
    public static readonly EntitlementReasonCode MembershipRequired = new("membership-required");
    public static readonly EntitlementReasonCode MembershipInvited = new("membership-invited");
    public static readonly EntitlementReasonCode MembershipInactive = new("membership-inactive");
    public static readonly EntitlementReasonCode MembershipRemoved = new("membership-removed");
    public static readonly EntitlementReasonCode SubscriptionMissing = new("subscription-missing");
    public static readonly EntitlementReasonCode FactsUnavailable = new("facts-unavailable");
    public static readonly EntitlementReasonCode PolicyError = new("policy-error");
}

public sealed record EntitlementQuota(string Unit, int Limit);

public sealed record PlanEntitlement(PlanKey Plan, EntitlementQuota? Quota = null);

public sealed record FeatureEntitlement
{
    public FeatureEntitlement(
        FeatureKey key,
        OrganizationAuthorityRequirement authorityRequirement,
        IEnumerable<PlanEntitlement> planAccess,
        IEnumerable<AddOnKey> requiredAddOns,
        IEnumerable<ReadinessDependencyKey> readinessDependencies)
    {
        ArgumentNullException.ThrowIfNull(authorityRequirement);
        ArgumentNullException.ThrowIfNull(planAccess);
        ArgumentNullException.ThrowIfNull(requiredAddOns);
        ArgumentNullException.ThrowIfNull(readinessDependencies);

        Key = key;
        AuthorityRequirement = authorityRequirement;
        PlanAccess = ImmutableCollections.Copy(planAccess);
        RequiredAddOns = ImmutableCollections.Copy(requiredAddOns);
        ReadinessDependencies = ImmutableCollections.Copy(readinessDependencies);
    }

    public FeatureKey Key { get; }
    public OrganizationAuthorityRequirement AuthorityRequirement { get; }
    public IReadOnlyList<PlanEntitlement> PlanAccess { get; }
    public IReadOnlyList<AddOnKey> RequiredAddOns { get; }
    public IReadOnlyList<ReadinessDependencyKey> ReadinessDependencies { get; }
}

/// <summary>Runtime facts required to turn catalog metadata into an authoritative decision.</summary>
public sealed record EntitlementEvaluationFacts(
    int? CurrentUsage = null,
    IReadOnlySet<AddOnKey>? ActiveAddOns = null,
    IReadOnlyDictionary<ReadinessDependencyKey, bool>? Readiness = null);

public sealed record EntitlementDecision
{
    public EntitlementDecision(
        bool isAllowed,
        EntitlementReasonCode reason,
        EntitlementQuota? quota = null,
        IEnumerable<AddOnKey>? requiredAddOns = null,
        IEnumerable<ReadinessDependencyKey>? readinessDependencies = null)
    {
        IsAllowed = isAllowed;
        Reason = reason;
        Quota = quota;
        RequiredAddOns = ImmutableCollections.Copy(requiredAddOns ?? []);
        ReadinessDependencies = ImmutableCollections.Copy(readinessDependencies ?? []);
    }

    public bool IsAllowed { get; }
    public EntitlementReasonCode Reason { get; }
    public EntitlementQuota? Quota { get; }
    public IReadOnlyList<AddOnKey> RequiredAddOns { get; }
    public IReadOnlyList<ReadinessDependencyKey> ReadinessDependencies { get; }
}

internal static class ImmutableCollections
{
    public static ReadOnlyCollection<T> Copy<T>(IEnumerable<T> values) =>
        Array.AsReadOnly(values.ToArray());
}
