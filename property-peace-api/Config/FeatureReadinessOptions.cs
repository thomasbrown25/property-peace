namespace brownstone_hub_api.Config;

public enum FeatureReadinessState
{
    Unavailable,
    ComingSoon,
    ConfigurationRequired,
    Pilot,
    Available,
    Suspended,
}

public static class FeatureKeys
{
    public const string TenantScreening = "TenantScreening";
    public const string ListingSyndication = "ListingSyndication";
    public const string ESignature = "ESignature";
    public const string OnlineRentCollection = "OnlineRentCollection";
    public const string DedicatedSmsNumber = "DedicatedSmsNumber";
    public const string WrenAi = "WrenAI";

    public static IReadOnlyList<string> All { get; } =
    [TenantScreening, ListingSyndication, ESignature, OnlineRentCollection, DedicatedSmsNumber, WrenAi];
}

public sealed class FeatureReadinessOptions
{
    public const string SectionName = "FeatureReadiness";
    private const string LegacyWrenFeatureKey = "Percy";

    public Dictionary<string, FeatureReadinessState> Features { get; set; } =
        new(StringComparer.OrdinalIgnoreCase);

    // Pilot is intentionally fail-closed. An organization must be explicitly enrolled
    // for the specific feature; merely setting a feature's state to Pilot is insufficient.
    public Dictionary<string, List<long>> PilotOrganizations { get; set; } =
        new(StringComparer.OrdinalIgnoreCase);

    // E-signature is not a rollout switch. Operational provider and authorization
    // checks still determine whether a request may invoke DocuSign.
    public FeatureReadinessState GetState(string feature)
    {
        if (feature.Equals(FeatureKeys.ESignature, StringComparison.OrdinalIgnoreCase))
            return FeatureReadinessState.Available;

        if (TryGetFeatureValue(Features, feature, out var state) && Enum.IsDefined(state))
            return state;

        return FeatureReadinessState.Unavailable;
    }

    public bool IsPilotOrganization(string feature, long organizationId) =>
        TryGetFeatureValue(PilotOrganizations, feature, out var organizations)
        && organizations.Contains(organizationId);

    private static bool TryGetFeatureValue<T>(Dictionary<string, T> values, string feature, out T value)
    {
        if (values.TryGetValue(feature, out value!))
            return true;

        // Existing production configuration may still use the pre-rebrand key.
        return feature.Equals(FeatureKeys.WrenAi, StringComparison.OrdinalIgnoreCase)
            && values.TryGetValue(LegacyWrenFeatureKey, out value!);
    }
}
