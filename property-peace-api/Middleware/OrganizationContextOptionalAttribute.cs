namespace brownstone_hub_api.Middleware;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class OrganizationContextOptionalAttribute(bool tenantOnly = false) : Attribute
{
    public bool TenantOnly { get; } = tenantOnly;
}
