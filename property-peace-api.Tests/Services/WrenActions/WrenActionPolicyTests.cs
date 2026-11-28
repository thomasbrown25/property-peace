using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Services.WrenActions;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.WrenActions;

public sealed class WrenActionPolicyTests
{
    public static TheoryData<string, WrenActionCategory, bool, bool> KnownActions => new()
    {
        { WrenActionTypes.ReadPortfolio, WrenActionCategory.ReadOnly, false, true },
        { WrenActionTypes.ReadRentPayments, WrenActionCategory.ReadOnly, false, true },
        { WrenActionTypes.ReadMaintenance, WrenActionCategory.ReadOnly, false, true },
        { WrenActionTypes.ReadLeasesApplications, WrenActionCategory.ReadOnly, false, true },
        { WrenActionTypes.ReadUrgentMessages, WrenActionCategory.ReadOnly, false, true },
        { WrenActionTypes.DraftMaintenanceTroubleshooting, WrenActionCategory.Draft, false, true },
        { WrenActionTypes.RecordMaintenanceTroubleshootingOutcome, WrenActionCategory.ReversibleMutation, true, false },
        { WrenActionTypes.DraftLeadFollowUp, WrenActionCategory.Draft, false, true },
        { WrenActionTypes.DraftLeaseOutreach, WrenActionCategory.Draft, false, true },
        { WrenActionTypes.CollectionsForceFollowUp, WrenActionCategory.ReversibleMutation, true, false },
        { WrenActionTypes.CollectionsOrganizationFollowUp, WrenActionCategory.ReversibleMutation, true, false },
        { WrenActionTypes.ScreeningDecision, WrenActionCategory.LegalSensitive, true, false },
        { WrenActionTypes.ScreeningAdverseAction, WrenActionCategory.LegalSensitive, true, false },
        { WrenActionTypes.AccountingExplanation, WrenActionCategory.Financial, false, true },
        { WrenActionTypes.ArbitraryMessageInstruction, WrenActionCategory.Disallowed, true, false },
        { WrenActionTypes.ArbitraryDocumentInstruction, WrenActionCategory.Disallowed, true, false }
    };

    [Theory]
    [MemberData(nameof(KnownActions))]
    public void Evaluate_KnownAction_ReturnsExplicitFailClosedContract(
        string actionType,
        WrenActionCategory category,
        bool confirmationRequired,
        bool executionEnabled)
    {
        var decision = WrenActionPolicy.Evaluate(actionType);

        decision.ActionType.Should().Be(actionType);
        decision.Category.Should().Be(category);
        decision.IsKnown.Should().BeTrue();
        decision.ConfirmationRequired.Should().Be(confirmationRequired);
        decision.ExecutionEnabled.Should().Be(executionEnabled);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("portfolio")]
    [InlineData("collections.force_followup.lease ")]
    [InlineData("system.execute_arbitrary_command")]
    public void Evaluate_UnknownOrInexactAction_IsDisallowed(string? actionType)
    {
        var decision = WrenActionPolicy.Evaluate(actionType);

        decision.IsKnown.Should().BeFalse();
        decision.Category.Should().Be(WrenActionCategory.Disallowed);
        decision.ConfirmationRequired.Should().BeTrue();
        decision.ExecutionEnabled.Should().BeFalse();
        decision.AuthorityRequirement.Should().BeNull();
    }

    [Theory]
    [InlineData(WrenActionTypes.ReadPortfolio, OrganizationRole.Viewer, null)]
    [InlineData(WrenActionTypes.ReadRentPayments, OrganizationRole.Viewer, null)]
    [InlineData(WrenActionTypes.ReadMaintenance, OrganizationRole.Viewer, null)]
    [InlineData(WrenActionTypes.ReadLeasesApplications, OrganizationRole.Viewer, null)]
    [InlineData(WrenActionTypes.ReadUrgentMessages, OrganizationRole.Viewer, null)]
    [InlineData(WrenActionTypes.DraftMaintenanceTroubleshooting, OrganizationRole.Manager, OrganizationPermission.ManageMaintenance)]
    [InlineData(WrenActionTypes.RecordMaintenanceTroubleshootingOutcome, OrganizationRole.Manager, OrganizationPermission.ManageMaintenance)]
    [InlineData(WrenActionTypes.DraftLeadFollowUp, OrganizationRole.Manager, OrganizationPermission.ManageTenants)]
    [InlineData(WrenActionTypes.DraftLeaseOutreach, OrganizationRole.Manager, OrganizationPermission.ManageLeases)]
    [InlineData(WrenActionTypes.CollectionsForceFollowUp, OrganizationRole.Manager, OrganizationPermission.ManageBilling)]
    [InlineData(WrenActionTypes.CollectionsOrganizationFollowUp, OrganizationRole.Manager, OrganizationPermission.ManageBilling)]
    [InlineData(WrenActionTypes.ScreeningDecision, OrganizationRole.Owner, OrganizationPermission.ManageTenants)]
    [InlineData(WrenActionTypes.ScreeningAdverseAction, OrganizationRole.Owner, OrganizationPermission.ManageTenants)]
    [InlineData(WrenActionTypes.AccountingExplanation, OrganizationRole.Manager, OrganizationPermission.ManageBilling)]
    [InlineData(WrenActionTypes.ArbitraryMessageInstruction, OrganizationRole.Owner, null)]
    [InlineData(WrenActionTypes.ArbitraryDocumentInstruction, OrganizationRole.Owner, null)]
    public void Evaluate_KnownAction_HasExplicitAuthorityMetadata(
        string actionType, OrganizationRole role, OrganizationPermission? permission)
    {
        WrenActionPolicy.Evaluate(actionType).AuthorityRequirement.Should().Be(
            new OrganizationAuthorityRequirement(role, permission));
    }

    [Fact]
    public void Authorize_Viewer_CanOnlyUseBoundedReads()
    {
        foreach (var actionType in WrenActionTypes.All)
        {
            var authorization = WrenActionPolicy.Authorize(actionType, ActiveOrganization(), Member("Viewer"));
            authorization.IsAuthorized.Should().Be(
                WrenActionPolicy.Evaluate(actionType).Category == WrenActionCategory.ReadOnly,
                actionType);
        }
    }

    [Fact]
    public void Authorize_ManagerAndOwner_UseRoleAndPermissionDeterministically()
    {
        WrenActionPolicy.Authorize(WrenActionTypes.CollectionsOrganizationFollowUp,
            ActiveOrganization(), Member("Manager", OrganizationPermission.ManageBilling)).IsAuthorized.Should().BeTrue();
        WrenActionPolicy.Authorize(WrenActionTypes.CollectionsOrganizationFollowUp,
            ActiveOrganization(), Member("Manager")).Authority.Outcome.Should().Be(OrganizationAuthorityOutcome.MissingPermission);
        WrenActionPolicy.Authorize(WrenActionTypes.CollectionsOrganizationFollowUp,
            ActiveOrganization(), Member("Owner")).IsAuthorized.Should().BeTrue();
    }

    [Theory]
    [InlineData(false, "Viewer", 10, OrganizationAuthorityOutcome.InactiveMember)]
    [InlineData(true, "Viewer", 11, OrganizationAuthorityOutcome.WrongOrganization)]
    [InlineData(true, "SuperAdmin", 10, OrganizationAuthorityOutcome.UnknownRole)]
    public void Authorize_InvalidMembership_FailsClosed(
        bool active, string role, long memberOrganizationId, OrganizationAuthorityOutcome outcome)
    {
        var member = Member(role) with
        {
            OrganizationId = memberOrganizationId,
            State = active ? MembershipState.Active : MembershipState.Inactive
        };

        var authorization = WrenActionPolicy.Authorize(WrenActionTypes.ReadPortfolio, ActiveOrganization(), member);

        authorization.IsAuthorized.Should().BeFalse();
        authorization.Authority.Outcome.Should().Be(outcome);
    }

    [Fact]
    public void Authorize_UnknownAction_FailsClosedBeforeAuthority()
    {
        var authorization = WrenActionPolicy.Authorize("unknown.action", ActiveOrganization(), Member("Owner"));

        authorization.IsAuthorized.Should().BeFalse();
        authorization.Action.IsKnown.Should().BeFalse();
        authorization.Authority.Outcome.Should().Be(OrganizationAuthorityOutcome.UnknownRequirement);
    }

    private static OrganizationAuthorityFacts ActiveOrganization() => new(10, true, true, false);

    private static OrganizationMembershipFacts Member(
        string role, params OrganizationPermission[] permissions) => new(
            10,
            MembershipState.Active,
            Enum.TryParse<OrganizationRole>(role, true, out var parsed) ? parsed : null,
            role,
            permissions);
}
