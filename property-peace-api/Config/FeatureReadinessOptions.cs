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
    public const string Percy = "Percy";

    public static IReadOnlyList<string> All { get; } =
    [TenantScreening, ListingSyndication, ESignature, OnlineRentCollection, DedicatedSmsNumber, Percy];
}

public sealed class FeatureReadinessOptions
{
    public const string SectionName = "FeatureReadiness";

    public Dictionary<string, FeatureReadinessState> Features { get; set; } =
        new(StringComparer.OrdinalIgnoreCase);

    // Pilot is intentionally fail-closed. An organization must be explicitly enrolled
    // for the specific feature; merely setting a feature's state to Pilot is insufficient.
    public Dictionary<string, List<long>> PilotOrganizations { get; set; } =
        new(StringComparer.OrdinalIgnoreCase);

    public FeatureReadinessState GetState(string feature) =>
        Features.TryGetValue(feature, out var state) && Enum.IsDefined(state)
            ? state
            : FeatureReadinessState.Unavailable;

    public bool IsPilotOrganization(string feature, long organizationId) =>
        PilotOrganizations.FirstOrDefault(entry =>
                entry.Key.Equals(feature, StringComparison.OrdinalIgnoreCase)).Value?
            .Contains(organizationId) == true;
}
