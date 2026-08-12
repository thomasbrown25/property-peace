using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Services.PercyActions;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.PercyActions;

public sealed class PercyActionPolicyTests
{
    public static TheoryData<string, PercyActionCategory, bool, bool> KnownActions => new()
    {
        { PercyActionTypes.ReadPortfolio, PercyActionCategory.ReadOnly, false, true },
        { PercyActionTypes.ReadRentPayments, PercyActionCategory.ReadOnly, false, true },
        { PercyActionTypes.ReadMaintenance, PercyActionCategory.ReadOnly, false, true },
        { PercyActionTypes.ReadLeasesApplications, PercyActionCategory.ReadOnly, false, true },
        { PercyActionTypes.ReadUrgentMessages, PercyActionCategory.ReadOnly, false, true },
        { PercyActionTypes.DraftMaintenanceTroubleshooting, PercyActionCategory.Draft, false, true },
        { PercyActionTypes.RecordMaintenanceTroubleshootingOutcome, PercyActionCategory.ReversibleMutation, true, false },
        { PercyActionTypes.DraftLeadFollowUp, PercyActionCategory.Draft, false, true },
        { PercyActionTypes.DraftLeaseOutreach, PercyActionCategory.Draft, false, true },
        { PercyActionTypes.CollectionsForceFollowUp, PercyActionCategory.ReversibleMutation, true, false },
        { PercyActionTypes.CollectionsOrganizationFollowUp, PercyActionCategory.ReversibleMutation, true, false },
        { PercyActionTypes.ScreeningDecision, PercyActionCategory.LegalSensitive, true, false },
        { PercyActionTypes.ScreeningAdverseAction, PercyActionCategory.LegalSensitive, true, false },
        { PercyActionTypes.AccountingExplanation, PercyActionCategory.Financial, false, true },
        { PercyActionTypes.ArbitraryMessageInstruction, PercyActionCategory.Disallowed, true, false },
        { PercyActionTypes.ArbitraryDocumentInstruction, PercyActionCategory.Disallowed, true, false }
    };

    [Theory]
    [MemberData(nameof(KnownActions))]
    public void Evaluate_KnownAction_ReturnsExplicitFailClosedContract(
        string actionType,
        PercyActionCategory category,
        bool confirmationRequired,
        bool executionEnabled)
    {
        var decision = PercyActionPolicy.Evaluate(actionType);

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
        var decision = PercyActionPolicy.Evaluate(actionType);

        decision.IsKnown.Should().BeFalse();
        decision.Category.Should().Be(PercyActionCategory.Disallowed);
        decision.ConfirmationRequired.Should().BeTrue();
        decision.ExecutionEnabled.Should().BeFalse();
        decision.AuthorityRequirement.Should().BeNull();
    }

    [Theory]
    [InlineData(PercyActionTypes.ReadPortfolio, OrganizationRole.Viewer, null)]
    [InlineData(PercyActionTypes.ReadRentPayments, OrganizationRole.Viewer, null)]
    [InlineData(PercyActionTypes.ReadMaintenance, OrganizationRole.Viewer, null)]
    [InlineData(PercyActionTypes.ReadLeasesApplications, OrganizationRole.Viewer, null)]
    [InlineData(PercyActionTypes.ReadUrgentMessages, OrganizationRole.Viewer, null)]
    [InlineData(PercyActionTypes.DraftMaintenanceTroubleshooting, OrganizationRole.Manager, OrganizationPermission.ManageMaintenance)]
    [InlineData(PercyActionTypes.RecordMaintenanceTroubleshootingOutcome, OrganizationRole.Manager, OrganizationPermission.ManageMaintenance)]
    [InlineData(PercyActionTypes.DraftLeadFollowUp, OrganizationRole.Manager, OrganizationPermission.ManageTenants)]
    [InlineData(PercyActionTypes.DraftLeaseOutreach, OrganizationRole.Manager, OrganizationPermission.ManageLeases)]
    [InlineData(PercyActionTypes.CollectionsForceFollowUp, OrganizationRole.Manager, OrganizationPermission.ManageBilling)]
    [InlineData(PercyActionTypes.CollectionsOrganizationFollowUp, OrganizationRole.Manager, OrganizationPermission.ManageBilling)]
    [InlineData(PercyActionTypes.ScreeningDecision, OrganizationRole.Owner, OrganizationPermission.ManageTenants)]
    [InlineData(PercyActionTypes.ScreeningAdverseAction, OrganizationRole.Owner, OrganizationPermission.ManageTenants)]
    [InlineData(PercyActionTypes.AccountingExplanation, OrganizationRole.Manager, OrganizationPermission.ManageBilling)]
    [InlineData(PercyActionTypes.ArbitraryMessageInstruction, OrganizationRole.Owner, null)]
    [InlineData(PercyActionTypes.ArbitraryDocumentInstruction, OrganizationRole.Owner, null)]
    public void Evaluate_KnownAction_HasExplicitAuthorityMetadata(
        string actionType, OrganizationRole role, OrganizationPermission? permission)
    {
        PercyActionPolicy.Evaluate(actionType).AuthorityRequirement.Should().Be(
            new OrganizationAuthorityRequirement(role, permission));
    }

    [Fact]
    public void Authorize_Viewer_CanOnlyUseBoundedReads()
    {
        foreach (var actionType in PercyActionTypes.All)
        {
            var authorization = PercyActionPolicy.Authorize(actionType, ActiveOrganization(), Member("Viewer"));
            authorization.IsAuthorized.Should().Be(
                PercyActionPolicy.Evaluate(actionType).Category == PercyActionCategory.ReadOnly,
                actionType);
        }
    }

    [Fact]
    public void Authorize_ManagerAndOwner_UseRoleAndPermissionDeterministically()
    {
        PercyActionPolicy.Authorize(PercyActionTypes.CollectionsOrganizationFollowUp,
            ActiveOrganization(), Member("Manager", OrganizationPermission.ManageBilling)).IsAuthorized.Should().BeTrue();
        PercyActionPolicy.Authorize(PercyActionTypes.CollectionsOrganizationFollowUp,
            ActiveOrganization(), Member("Manager")).Authority.Outcome.Should().Be(OrganizationAuthorityOutcome.MissingPermission);
        PercyActionPolicy.Authorize(PercyActionTypes.CollectionsOrganizationFollowUp,
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

        var authorization = PercyActionPolicy.Authorize(PercyActionTypes.ReadPortfolio, ActiveOrganization(), member);

        authorization.IsAuthorized.Should().BeFalse();
        authorization.Authority.Outcome.Should().Be(outcome);
    }

    [Fact]
    public void Authorize_UnknownAction_FailsClosedBeforeAuthority()
    {
        var authorization = PercyActionPolicy.Authorize("unknown.action", ActiveOrganization(), Member("Owner"));

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
