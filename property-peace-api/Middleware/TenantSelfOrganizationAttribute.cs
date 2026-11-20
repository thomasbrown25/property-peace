namespace brownstone_hub_api.Middleware;

/// <summary>Opt-in for lease-derived tenant self-service context, never organization membership.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class TenantSelfOrganizationAttribute(
    bool allowWithoutOrganization = false,
    bool allowPersonalHubConnection = false,
    bool tenantOnly = false) : Attribute
{
    public bool AllowWithoutOrganization { get; } = allowWithoutOrganization;
    public bool AllowPersonalHubConnection { get; } = allowPersonalHubConnection;
    public bool TenantOnly { get; } = tenantOnly || allowPersonalHubConnection;
}
