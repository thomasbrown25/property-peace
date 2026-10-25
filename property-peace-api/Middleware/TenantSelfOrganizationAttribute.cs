namespace brownstone_hub_api.Middleware;

/// <summary>Opt-in for lease-derived tenant self-service context, never organization membership.</summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class TenantSelfOrganizationAttribute(bool allowWithoutOrganization = false) : Attribute
{
    public bool AllowWithoutOrganization { get; } = allowWithoutOrganization;
}