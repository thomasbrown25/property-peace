namespace brownstone_hub_api.Services.PercyActions;

using brownstone_hub_api.Entitlements.Policy;

public static class PercyActionErrorCodes
{
    public const string Forbidden = "percy_action_forbidden";
    public const string Unavailable = "percy_action_unavailable";
}

public enum PercyActionCategory
{
    ReadOnly,
    Draft,
    ReversibleMutation,
    Financial,
    LegalSensitive,
    Disallowed
}

public sealed record PercyActionDecision(
    string? ActionType,
    PercyActionCategory Category,
    bool IsKnown,
    bool ConfirmationRequired,
    bool ExecutionEnabled,
    OrganizationAuthorityRequirement? AuthorityRequirement);

public sealed record PercyActionAuthorization(
    PercyActionDecision Action,
    OrganizationAuthorityDecision Authority)
{
    public bool IsAuthorized => Action.IsKnown && Authority.IsAllowed;
    public bool IsAvailable => IsAuthorized && Action.ExecutionEnabled;
}

/// <summary>
/// Authoritative, fail-closed policy for every server-issued Percy action. Confirmation cannot
/// override action availability or current organization authority.
/// </summary>
public static class PercyActionPolicy
{
    private static readonly IReadOnlyDictionary<string, PercyActionDecision> Decisions =
        new Dictionary<string, PercyActionDecision>(StringComparer.Ordinal)
        {
            [PercyActionTypes.ReadPortfolio] = Enabled(PercyActionTypes.ReadPortfolio, PercyActionCategory.ReadOnly, OrganizationRole.Viewer),
            [PercyActionTypes.ReadRentPayments] = Enabled(PercyActionTypes.ReadRentPayments, PercyActionCategory.ReadOnly, OrganizationRole.Viewer),
            [PercyActionTypes.ReadMaintenance] = Enabled(PercyActionTypes.ReadMaintenance, PercyActionCategory.ReadOnly, OrganizationRole.Viewer),
            [PercyActionTypes.ReadLeasesApplications] = Enabled(PercyActionTypes.ReadLeasesApplications, PercyActionCategory.ReadOnly, OrganizationRole.Viewer),
            [PercyActionTypes.ReadUrgentMessages] = Enabled(PercyActionTypes.ReadUrgentMessages, PercyActionCategory.ReadOnly, OrganizationRole.Viewer),
            [PercyActionTypes.DraftMaintenanceTroubleshooting] = Enabled(PercyActionTypes.DraftMaintenanceTroubleshooting, PercyActionCategory.Draft, OrganizationRole.Manager, OrganizationPermission.ManageMaintenance),
            [PercyActionTypes.RecordMaintenanceTroubleshootingOutcome] = Blocked(PercyActionTypes.RecordMaintenanceTroubleshootingOutcome, PercyActionCategory.ReversibleMutation, OrganizationRole.Manager, OrganizationPermission.ManageMaintenance),
            [PercyActionTypes.DraftLeadFollowUp] = Enabled(PercyActionTypes.DraftLeadFollowUp, PercyActionCategory.Draft, OrganizationRole.Manager, OrganizationPermission.ManageTenants),
            [PercyActionTypes.DraftLeaseOutreach] = Enabled(PercyActionTypes.DraftLeaseOutreach, PercyActionCategory.Draft, OrganizationRole.Manager, OrganizationPermission.ManageLeases),
            [PercyActionTypes.CollectionsForceFollowUp] = Blocked(PercyActionTypes.CollectionsForceFollowUp, PercyActionCategory.ReversibleMutation, OrganizationRole.Manager, OrganizationPermission.ManageBilling),
            [PercyActionTypes.CollectionsOrganizationFollowUp] = Blocked(PercyActionTypes.CollectionsOrganizationFollowUp, PercyActionCategory.ReversibleMutation, OrganizationRole.Manager, OrganizationPermission.ManageBilling),
            [PercyActionTypes.ScreeningDecision] = Blocked(PercyActionTypes.ScreeningDecision, PercyActionCategory.LegalSensitive, OrganizationRole.Owner, OrganizationPermission.ManageTenants),
            [PercyActionTypes.ScreeningAdverseAction] = Blocked(PercyActionTypes.ScreeningAdverseAction, PercyActionCategory.LegalSensitive, OrganizationRole.Owner, OrganizationPermission.ManageTenants),
            [PercyActionTypes.AccountingExplanation] = Enabled(PercyActionTypes.AccountingExplanation, PercyActionCategory.Financial, OrganizationRole.Manager, OrganizationPermission.ManageBilling),
            [PercyActionTypes.ArbitraryMessageInstruction] = Blocked(PercyActionTypes.ArbitraryMessageInstruction, PercyActionCategory.Disallowed, OrganizationRole.Owner),
            [PercyActionTypes.ArbitraryDocumentInstruction] = Blocked(PercyActionTypes.ArbitraryDocumentInstruction, PercyActionCategory.Disallowed, OrganizationRole.Owner)
        };

    public static PercyActionDecision Evaluate(string? actionType) =>
        actionType != null && Decisions.TryGetValue(actionType, out var decision)
            ? decision
            : new PercyActionDecision(actionType, PercyActionCategory.Disallowed, false, true, false, null);

    public static PercyActionAuthorization Authorize(
        string? actionType,
        OrganizationAuthorityFacts organization,
        OrganizationMembershipFacts membership)
    {
        var action = Evaluate(actionType);
        if (!action.IsKnown || action.AuthorityRequirement is null)
        {
            return new PercyActionAuthorization(action,
                new OrganizationAuthorityDecision(false, OrganizationAuthorityOutcome.UnknownRequirement,
                    EntitlementReasonCodes.UnknownPolicy));
        }

        return new PercyActionAuthorization(action,
            OrganizationAuthorityPolicy.Evaluate(organization, membership, action.AuthorityRequirement));
    }

    private static PercyActionDecision Enabled(
        string actionType, PercyActionCategory category, OrganizationRole role,
        OrganizationPermission? permission = null) =>
        new(actionType, category, true, false, true, new OrganizationAuthorityRequirement(role, permission));

    private static PercyActionDecision Blocked(
        string actionType, PercyActionCategory category, OrganizationRole role,
        OrganizationPermission? permission = null) =>
        new(actionType, category, true, true, false, new OrganizationAuthorityRequirement(role, permission));
}
