using brownstone_hub_api.Entitlements.Policy;
using Xunit;

namespace brownstone_hub_api.Tests.Security;

public sealed class OrganizationAuthorityPolicyTests
{
    private static readonly OrganizationAuthorityFacts ActiveOrganization = new(10, Exists: true, IsActive: true, IsDeleted: false);

    [Theory]
    [InlineData(OrganizationRole.Owner, OrganizationRole.Owner)]
    [InlineData(OrganizationRole.Owner, OrganizationRole.Manager)]
    [InlineData(OrganizationRole.Manager, OrganizationRole.Manager)]
    [InlineData(OrganizationRole.Manager, OrganizationRole.Viewer)]
    [InlineData(OrganizationRole.Viewer, OrganizationRole.Viewer)]
    public void Active_members_satisfy_role_hierarchy(OrganizationRole actual, OrganizationRole required)
    {
        var decision = Evaluate(Member(MembershipState.Active, actual), required);

        Assert.True(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.Allowed, decision.Outcome);
        Assert.Equal(EntitlementReasonCodes.Allowed, decision.Reason);
    }

    [Fact]
    public void Active_member_below_required_role_is_unauthorized()
    {
        var decision = Evaluate(Member(MembershipState.Active, OrganizationRole.Viewer), OrganizationRole.Manager);

        Assert.False(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.InsufficientRole, decision.Outcome);
        Assert.Equal(EntitlementReasonCodes.Unauthorized, decision.Reason);
    }

    [Fact]
    public void Required_permission_must_be_present()
    {
        var denied = Evaluate(Member(MembershipState.Active, OrganizationRole.Manager), OrganizationRole.Manager, OrganizationPermission.ManageProperties);
        var allowed = Evaluate(Member(MembershipState.Active, OrganizationRole.Manager, OrganizationPermission.ManageProperties), OrganizationRole.Manager, OrganizationPermission.ManageProperties);

        Assert.Equal(OrganizationAuthorityOutcome.MissingPermission, denied.Outcome);
        Assert.Equal(EntitlementReasonCodes.Unauthorized, denied.Reason);
        Assert.True(allowed.IsAllowed);
    }

    [Fact]
    public void Owner_has_implicit_organization_permissions()
    {
        var decision = Evaluate(Member(MembershipState.Active, OrganizationRole.Owner), OrganizationRole.Owner, OrganizationPermission.ManageBilling);

        Assert.True(decision.IsAllowed);
    }

    [Theory]
    [InlineData(MembershipState.Invited, OrganizationAuthorityOutcome.Invited)]
    [InlineData(MembershipState.Inactive, OrganizationAuthorityOutcome.InactiveMember)]
    [InlineData(MembershipState.Removed, OrganizationAuthorityOutcome.RemovedMember)]
    [InlineData(MembershipState.Missing, OrganizationAuthorityOutcome.MissingMember)]
    public void Non_active_memberships_are_distinguished(MembershipState state, OrganizationAuthorityOutcome outcome)
    {
        var decision = Evaluate(Member(state, OrganizationRole.Owner), OrganizationRole.Viewer);

        Assert.False(decision.IsAllowed);
        Assert.Equal(outcome, decision.Outcome);
        Assert.Equal(
            state == MembershipState.Inactive ? EntitlementReasonCodes.Inactive : EntitlementReasonCodes.Unauthorized,
            decision.Reason);
    }

    [Fact]
    public void Membership_for_wrong_organization_is_denied()
    {
        var member = Member(MembershipState.Active, OrganizationRole.Owner) with { OrganizationId = 99 };

        var decision = Evaluate(member, OrganizationRole.Viewer);

        Assert.False(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.WrongOrganization, decision.Outcome);
        Assert.Equal(EntitlementReasonCodes.Unauthorized, decision.Reason);
    }

    [Theory]
    [InlineData(false, false, OrganizationAuthorityOutcome.MissingOrganization)]
    [InlineData(true, false, OrganizationAuthorityOutcome.InactiveOrganization)]
    [InlineData(true, true, OrganizationAuthorityOutcome.DeletedOrganization)]
    public void Unavailable_organizations_are_distinguished(bool exists, bool deleted, OrganizationAuthorityOutcome outcome)
    {
        var organization = new OrganizationAuthorityFacts(10, exists, IsActive: false, IsDeleted: deleted);

        var decision = OrganizationAuthorityPolicy.Evaluate(
            organization,
            Member(MembershipState.Active, OrganizationRole.Owner),
            new OrganizationAuthorityRequirement(OrganizationRole.Viewer));

        Assert.False(decision.IsAllowed);
        Assert.Equal(outcome, decision.Outcome);
        Assert.Equal(exists ? EntitlementReasonCodes.Inactive : EntitlementReasonCodes.Unavailable, decision.Reason);
    }

    [Fact]
    public void Unknown_role_fails_closed()
    {
        var decision = Evaluate(Member(MembershipState.Active, null, rawRole: "SuperOwner"), OrganizationRole.Viewer);

        Assert.False(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.UnknownRole, decision.Outcome);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, decision.Reason);
    }

    [Fact]
    public void Undefined_member_role_fails_closed()
    {
        var decision = Evaluate(Member(MembershipState.Active, (OrganizationRole)999), OrganizationRole.Viewer);

        Assert.False(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.UnknownRole, decision.Outcome);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, decision.Reason);
    }

    [Fact]
    public void Persisted_raw_role_is_authoritative_and_must_agree_with_typed_role()
    {
        var contradictory = Member(MembershipState.Active, OrganizationRole.Owner, rawRole: "Viewer");
        var decision = Evaluate(contradictory, OrganizationRole.Viewer);

        Assert.False(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.UnknownRole, decision.Outcome);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, decision.Reason);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("SuperOwner")]
    public void Missing_blank_or_unknown_persisted_role_fails_closed(string? rawRole)
    {
        var decision = Evaluate(
            Member(MembershipState.Active, OrganizationRole.Owner, rawRole: rawRole, preserveRawRole: true),
            OrganizationRole.Viewer);

        Assert.False(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.UnknownRole, decision.Outcome);
    }

    [Fact]
    public void Known_persisted_role_can_be_parsed_without_a_duplicate_typed_role()
    {
        var decision = Evaluate(Member(MembershipState.Active, null, rawRole: "mAnAgEr"), OrganizationRole.Manager);

        Assert.True(decision.IsAllowed);
    }

    [Fact]
    public void Null_permissions_deny_deterministically_when_permission_is_required()
    {
        var member = Member(MembershipState.Active, OrganizationRole.Manager) with { Permissions = null! };
        var decision = Evaluate(member, OrganizationRole.Manager, OrganizationPermission.ManageProperties);

        Assert.False(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.MissingPermission, decision.Outcome);
    }

    [Fact]
    public void Undefined_required_role_fails_closed_as_unknown_policy()
    {
        var decision = Evaluate(Member(MembershipState.Active, OrganizationRole.Owner), (OrganizationRole)999);

        Assert.False(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.UnknownRequirement, decision.Outcome);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, decision.Reason);
    }

    [Fact]
    public void Undefined_required_permission_fails_closed_as_unknown_policy()
    {
        var decision = Evaluate(
            Member(MembershipState.Active, OrganizationRole.Owner),
            OrganizationRole.Viewer,
            (OrganizationPermission)999);

        Assert.False(decision.IsAllowed);
        Assert.Equal(OrganizationAuthorityOutcome.UnknownRequirement, decision.Outcome);
        Assert.Equal(EntitlementReasonCodes.UnknownPolicy, decision.Reason);
    }

    private static OrganizationAuthorityDecision Evaluate(
        OrganizationMembershipFacts member,
        OrganizationRole requiredRole,
        OrganizationPermission? permission = null) =>
        OrganizationAuthorityPolicy.Evaluate(
            ActiveOrganization,
            member,
            new OrganizationAuthorityRequirement(requiredRole, permission));

    private static OrganizationMembershipFacts Member(
        MembershipState state,
        OrganizationRole? role,
        OrganizationPermission? permission = null,
        string? rawRole = null,
        bool preserveRawRole = false) =>
        new(
            OrganizationId: 10,
            State: state,
            Role: role,
            RawRole: preserveRawRole ? rawRole : rawRole ?? role?.ToString(),
            Permissions: permission is null ? [] : [permission.Value]);
}
