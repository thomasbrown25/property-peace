namespace brownstone_hub_api.Entitlements.Policy;

public enum OrganizationRole
{
    Viewer = 1,
    Manager = 2,
    Owner = 3
}

public enum OrganizationPermission
{
    ManageProperties = 1,
    ManageTenants = 2,
    ManageLeases = 3,
    ManageMaintenance = 4,
    ManageBilling = 5,
    ManageMembers = 6
}

public enum MembershipState
{
    Missing = 0,
    Invited = 1,
    Active = 2,
    Inactive = 3,
    Removed = 4
}

public enum OrganizationAuthorityOutcome
{
    Allowed = 0,
    MissingOrganization = 1,
    InactiveOrganization = 2,
    DeletedOrganization = 3,
    MissingMember = 4,
    Invited = 5,
    InactiveMember = 6,
    RemovedMember = 7,
    WrongOrganization = 8,
    UnknownRole = 9,
    InsufficientRole = 10,
    MissingPermission = 11,
    UnknownRequirement = 12
}

public sealed record OrganizationAuthorityFacts(
    long OrganizationId,
    bool Exists,
    bool IsActive,
    bool IsDeleted);

public sealed record OrganizationMembershipFacts(
    long OrganizationId,
    MembershipState State,
    OrganizationRole? Role,
    string? RawRole,
    IReadOnlyCollection<OrganizationPermission> Permissions);

public sealed record OrganizationAuthorityRequirement(
    OrganizationRole RequiredRole,
    OrganizationPermission? RequiredPermission = null);

public sealed record OrganizationAuthorityDecision(
    bool IsAllowed,
    OrganizationAuthorityOutcome Outcome,
    EntitlementReasonCode Reason);

public static class OrganizationAuthorityPolicy
{
    public static OrganizationAuthorityDecision Evaluate(
        OrganizationAuthorityFacts organization,
        OrganizationMembershipFacts membership,
        OrganizationAuthorityRequirement requirement)
    {
        ArgumentNullException.ThrowIfNull(organization);
        ArgumentNullException.ThrowIfNull(membership);
        ArgumentNullException.ThrowIfNull(requirement);


        if (!Enum.IsDefined(requirement.RequiredRole) ||
            (requirement.RequiredPermission.HasValue && !Enum.IsDefined(requirement.RequiredPermission.Value)))
        {
            return Denied(OrganizationAuthorityOutcome.UnknownRequirement, EntitlementReasonCodes.UnknownPolicy);
        }

        if (!organization.Exists)
        {
            return Denied(OrganizationAuthorityOutcome.MissingOrganization, EntitlementReasonCodes.Unavailable);
        }

        if (organization.IsDeleted)
        {
            return Denied(OrganizationAuthorityOutcome.DeletedOrganization, EntitlementReasonCodes.Inactive);
        }

        if (!organization.IsActive)
        {
            return Denied(OrganizationAuthorityOutcome.InactiveOrganization, EntitlementReasonCodes.Inactive);
        }

        if (membership.OrganizationId != organization.OrganizationId)
        {
            return Denied(OrganizationAuthorityOutcome.WrongOrganization, EntitlementReasonCodes.Unauthorized);
        }

        var membershipDecision = membership.State switch
        {
            MembershipState.Missing => Denied(OrganizationAuthorityOutcome.MissingMember, EntitlementReasonCodes.Unauthorized),
            MembershipState.Invited => Denied(OrganizationAuthorityOutcome.Invited, EntitlementReasonCodes.Unauthorized),
            MembershipState.Inactive => Denied(OrganizationAuthorityOutcome.InactiveMember, EntitlementReasonCodes.Inactive),
            MembershipState.Removed => Denied(OrganizationAuthorityOutcome.RemovedMember, EntitlementReasonCodes.Unauthorized),
            MembershipState.Active => null,
            _ => Denied(OrganizationAuthorityOutcome.MissingMember, EntitlementReasonCodes.UnknownPolicy)
        };

        if (membershipDecision is not null)
        {
            return membershipDecision;
        }

        if (!TryParsePersistedRole(membership.RawRole, out var persistedRole) ||
            (membership.Role.HasValue &&
                (!Enum.IsDefined(membership.Role.Value) || membership.Role.Value != persistedRole)))
        {
            return Denied(OrganizationAuthorityOutcome.UnknownRole, EntitlementReasonCodes.UnknownPolicy);
        }

        if (RoleRank(persistedRole) < RoleRank(requirement.RequiredRole))
        {
            return Denied(OrganizationAuthorityOutcome.InsufficientRole, EntitlementReasonCodes.Unauthorized);
        }

        var hasPermission = requirement.RequiredPermission is null ||
            persistedRole == OrganizationRole.Owner ||
            (membership.Permissions?.Contains(requirement.RequiredPermission.Value) ?? false);

        if (!hasPermission)
        {
            return Denied(OrganizationAuthorityOutcome.MissingPermission, EntitlementReasonCodes.Unauthorized);
        }

        return new(true, OrganizationAuthorityOutcome.Allowed, EntitlementReasonCodes.Allowed);
    }

    private static OrganizationAuthorityDecision Denied(
        OrganizationAuthorityOutcome outcome,
        EntitlementReasonCode reason) => new(false, outcome, reason);

    private static bool TryParsePersistedRole(string? rawRole, out OrganizationRole role)
    {
        if (string.Equals(rawRole, nameof(OrganizationRole.Viewer), StringComparison.OrdinalIgnoreCase))
        {
            role = OrganizationRole.Viewer;
            return true;
        }

        if (string.Equals(rawRole, nameof(OrganizationRole.Manager), StringComparison.OrdinalIgnoreCase))
        {
            role = OrganizationRole.Manager;
            return true;
        }

        if (string.Equals(rawRole, nameof(OrganizationRole.Owner), StringComparison.OrdinalIgnoreCase))
        {
            role = OrganizationRole.Owner;
            return true;
        }

        role = default;
        return false;
    }

    private static int RoleRank(OrganizationRole role) => role switch
    {
        OrganizationRole.Viewer => 1,
        OrganizationRole.Manager => 2,
        OrganizationRole.Owner => 3,
        _ => 0
    };
}
