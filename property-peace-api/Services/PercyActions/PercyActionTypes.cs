namespace brownstone_hub_api.Services.PercyActions;

/// <summary>
/// Immutable server-issued action identifiers. Model output and client instructions must never
/// be treated as action identifiers unless they exactly match this allowlist.
/// </summary>
public static class PercyActionTypes
{
    public const string ReadPortfolio = "read.portfolio";
    public const string ReadRentPayments = "read.rent_payments";
    public const string ReadMaintenance = "read.maintenance";
    public const string ReadLeasesApplications = "read.leases_applications";
    public const string ReadUrgentMessages = "read.urgent_messages";

    public const string DraftMaintenanceTroubleshooting = "maintenance.troubleshooting.draft";
    public const string RecordMaintenanceTroubleshootingOutcome = "maintenance.troubleshooting.outcome.record";
    public const string DraftLeadFollowUp = "lead.follow_up.draft";
    public const string DraftLeaseOutreach = "lease.outreach.draft";

    public const string CollectionsForceFollowUp = "collections.force_followup.lease";
    public const string CollectionsOrganizationFollowUp = "collections.follow_up.organization";
    public const string ScreeningDecision = "screening.decision";
    public const string ScreeningAdverseAction = "screening.adverse_action";
    public const string AccountingExplanation = "accounting.explanation";

    public const string ArbitraryMessageInstruction = "instruction.message.arbitrary";
    public const string ArbitraryDocumentInstruction = "instruction.document.arbitrary";

    public static IReadOnlyList<string> All { get; } =
    [
        ReadPortfolio,
        ReadRentPayments,
        ReadMaintenance,
        ReadLeasesApplications,
        ReadUrgentMessages,
        DraftMaintenanceTroubleshooting,
        RecordMaintenanceTroubleshootingOutcome,
        DraftLeadFollowUp,
        DraftLeaseOutreach,
        CollectionsForceFollowUp,
        CollectionsOrganizationFollowUp,
        ScreeningDecision,
        ScreeningAdverseAction,
        AccountingExplanation,
        ArbitraryMessageInstruction,
        ArbitraryDocumentInstruction
    ];
}
