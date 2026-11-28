namespace brownstone_hub_api.Services.WrenActions;

using brownstone_hub_api.Entitlements.Policy;

public static class WrenActionErrorCodes
{
    public const string Forbidden = "wren_action_forbidden";
    public const string Unavailable = "wren_action_unavailable";
}

public enum WrenActionCategory
{
    ReadOnly,
    Draft,
    ReversibleMutation,
    Financial,
    LegalSensitive,
    Disallowed
}

public sealed record WrenActionDecision(
    string? ActionType,
    WrenActionCategory Category,
    bool IsKnown,
    bool ConfirmationRequired,
    bool ExecutionEnabled,
    OrganizationAuthorityRequirement? AuthorityRequirement);

public sealed record WrenActionAuthorization(
    WrenActionDecision Action,
    OrganizationAuthorityDecision Authority)
{
    public bool IsAuthorized => Action.IsKnown && Authority.IsAllowed;
    public bool IsAvailable => IsAuthorized && Action.ExecutionEnabled;
}

/// <summary>
/// Authoritative, fail-closed policy for every server-issued Wren AI action. Confirmation cannot
/// override action availability or current organization authority.
/// </summary>
public static class WrenActionPolicy
{
    private static readonly IReadOnlyDictionary<string, WrenActionDecision> Decisions =
        new Dictionary<string, WrenActionDecision>(StringComparer.Ordinal)
        {
            [WrenActionTypes.ReadPortfolio] = Enabled(WrenActionTypes.ReadPortfolio, WrenActionCategory.ReadOnly, OrganizationRole.Viewer),
            [WrenActionTypes.ReadRentPayments] = Enabled(WrenActionTypes.ReadRentPayments, WrenActionCategory.ReadOnly, OrganizationRole.Viewer),
            [WrenActionTypes.ReadMaintenance] = Enabled(WrenActionTypes.ReadMaintenance, WrenActionCategory.ReadOnly, OrganizationRole.Viewer),
            [WrenActionTypes.ReadLeasesApplications] = Enabled(WrenActionTypes.ReadLeasesApplications, WrenActionCategory.ReadOnly, OrganizationRole.Viewer),
            [WrenActionTypes.ReadUrgentMessages] = Enabled(WrenActionTypes.ReadUrgentMessages, WrenActionCategory.ReadOnly, OrganizationRole.Viewer),
            [WrenActionTypes.ReadTenantContacts] = Enabled(WrenActionTypes.ReadTenantContacts, WrenActionCategory.ReadOnly, OrganizationRole.Viewer),
            [WrenActionTypes.DraftMaintenanceTroubleshooting] = Enabled(WrenActionTypes.DraftMaintenanceTroubleshooting, WrenActionCategory.Draft, OrganizationRole.Manager, OrganizationPermission.ManageMaintenance),
            [WrenActionTypes.RecordMaintenanceTroubleshootingOutcome] = Blocked(WrenActionTypes.RecordMaintenanceTroubleshootingOutcome, WrenActionCategory.ReversibleMutation, OrganizationRole.Manager, OrganizationPermission.ManageMaintenance),
            [WrenActionTypes.DraftLeadFollowUp] = Enabled(WrenActionTypes.DraftLeadFollowUp, WrenActionCategory.Draft, OrganizationRole.Manager, OrganizationPermission.ManageTenants),
            [WrenActionTypes.DraftLeaseOutreach] = Enabled(WrenActionTypes.DraftLeaseOutreach, WrenActionCategory.Draft, OrganizationRole.Manager, OrganizationPermission.ManageLeases),
            [WrenActionTypes.CollectionsForceFollowUp] = Blocked(WrenActionTypes.CollectionsForceFollowUp, WrenActionCategory.ReversibleMutation, OrganizationRole.Manager, OrganizationPermission.ManageBilling),
            [WrenActionTypes.CollectionsOrganizationFollowUp] = Blocked(WrenActionTypes.CollectionsOrganizationFollowUp, WrenActionCategory.ReversibleMutation, OrganizationRole.Manager, OrganizationPermission.ManageBilling),
            [WrenActionTypes.ScreeningDecision] = Blocked(WrenActionTypes.ScreeningDecision, WrenActionCategory.LegalSensitive, OrganizationRole.Owner, OrganizationPermission.ManageTenants),
            [WrenActionTypes.ScreeningAdverseAction] = Blocked(WrenActionTypes.ScreeningAdverseAction, WrenActionCategory.LegalSensitive, OrganizationRole.Owner, OrganizationPermission.ManageTenants),
            [WrenActionTypes.AccountingExplanation] = Enabled(WrenActionTypes.AccountingExplanation, WrenActionCategory.Financial, OrganizationRole.Manager, OrganizationPermission.ManageBilling),
            [WrenActionTypes.ArbitraryMessageInstruction] = Blocked(WrenActionTypes.ArbitraryMessageInstruction, WrenActionCategory.Disallowed, OrganizationRole.Owner),
            [WrenActionTypes.ArbitraryDocumentInstruction] = Blocked(WrenActionTypes.ArbitraryDocumentInstruction, WrenActionCategory.Disallowed, OrganizationRole.Owner)
        };

    public static WrenActionDecision Evaluate(string? actionType) =>
        actionType != null && Decisions.TryGetValue(actionType, out var decision)
            ? decision
            : new WrenActionDecision(actionType, WrenActionCategory.Disallowed, false, true, false, null);

    public static WrenActionAuthorization Authorize(
        string? actionType,
        OrganizationAuthorityFacts organization,
        OrganizationMembershipFacts membership)
    {
        var action = Evaluate(actionType);
        if (!action.IsKnown || action.AuthorityRequirement is null)
        {
            return new WrenActionAuthorization(action,
                new OrganizationAuthorityDecision(false, OrganizationAuthorityOutcome.UnknownRequirement,
                    EntitlementReasonCodes.UnknownPolicy));
        }

        return new WrenActionAuthorization(action,
            OrganizationAuthorityPolicy.Evaluate(organization, membership, action.AuthorityRequirement));
    }

    private static WrenActionDecision Enabled(
        string actionType, WrenActionCategory category, OrganizationRole role,
        OrganizationPermission? permission = null) =>
        new(actionType, category, true, false, true, new OrganizationAuthorityRequirement(role, permission));

    private static WrenActionDecision Blocked(
        string actionType, WrenActionCategory category, OrganizationRole role,
        OrganizationPermission? permission = null) =>
        new(actionType, category, true, true, false, new OrganizationAuthorityRequirement(role, permission));
}
