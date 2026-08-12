using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.Screening;

public sealed record CreateScreeningAdverseActionCommand(long OrganizationId, long ActorUserId, long ScreeningOrderId,
    long DecisionRevisionId, ScreeningAdverseActionType ActionType, ScreeningAdverseActionDeliveryChannel Channel)
{
    public override string ToString() => $"CreateScreeningAdverseActionCommand {{ Scope = [REDACTED], ActionType = {ActionType}, Channel = {Channel} }}";
}
public sealed record RetryScreeningAdverseActionDeliveryCommand(long OrganizationId, long ActorUserId, long AdverseActionId,
    ScreeningAdverseActionDeliveryChannel Channel);
public sealed record ScreeningReconsiderationCommand(long OrganizationId, long ActorUserId, long AdverseActionId, string Reason);
public sealed record ResolveScreeningReconsiderationCommand(long OrganizationId, long ActorUserId, long AdverseActionId,
    string Reason, long? NewDecisionRevisionId);

public sealed record AdverseActionPolicyResolutionRequest(long OrganizationId, long ScreeningOrderId, long RentalApplicationId,
    string JurisdictionCode, ScreeningAdverseActionType ActionType)
{
    public override string ToString() => "AdverseActionPolicyResolutionRequest { Context = [REDACTED] }";
}

/// <summary>Counsel-approved immutable server policy. This contract is engineering evidence, not legal approval.</summary>
public sealed record AdverseActionPolicySnapshot
{
    public AdverseActionPolicySnapshot(string noticeVersion, string statutoryDisclosureVersion, string stateLocalDisclosureVersion,
        string jurisdictionCode, string craName, string craAddress, string craPhone, string craDidNotDecideStatement,
        string disputeRightsStatement, string freeReportRightsStatement, string stateLocalDisclosure, bool hashOnlyStorage)
    {
        Text(noticeVersion, 100); Text(statutoryDisclosureVersion, 100); Text(stateLocalDisclosureVersion, 100);
        Text(jurisdictionCode, 10); Text(craName, 200); Text(craAddress, 500); Text(craPhone, 50);
        Text(craDidNotDecideStatement, 1000); Text(disputeRightsStatement, 1000); Text(freeReportRightsStatement, 1000);
        Text(stateLocalDisclosure, 2000);
        NoticeVersion = noticeVersion; StatutoryDisclosureVersion = statutoryDisclosureVersion;
        StateLocalDisclosureVersion = stateLocalDisclosureVersion; JurisdictionCode = jurisdictionCode;
        CraName = craName; CraAddress = craAddress; CraPhone = craPhone; CraDidNotDecideStatement = craDidNotDecideStatement;
        DisputeRightsStatement = disputeRightsStatement; FreeReportRightsStatement = freeReportRightsStatement;
        StateLocalDisclosure = stateLocalDisclosure; HashOnlyStorage = hashOnlyStorage;
    }
    public string NoticeVersion { get; }
    public string StatutoryDisclosureVersion { get; }
    public string StateLocalDisclosureVersion { get; }
    public string JurisdictionCode { get; }
    public string CraName { get; }
    public string CraAddress { get; }
    public string CraPhone { get; }
    internal string CraDidNotDecideStatement { get; }
    internal string DisputeRightsStatement { get; }
    internal string FreeReportRightsStatement { get; }
    internal string StateLocalDisclosure { get; }
    public bool HashOnlyStorage { get; }
    public override string ToString() => "AdverseActionPolicySnapshot { Policy = [REDACTED], Content = [REDACTED] }";
    private static void Text(string value, int max) => ScreeningContractValidation.ValidateBoundedText(value, max, nameof(value), false);
}

public interface IAdverseActionPolicyResolver
{
    Task<AdverseActionPolicySnapshot> ResolveAsync(AdverseActionPolicyResolutionRequest request, CancellationToken cancellationToken = default);
}

public sealed record ScreeningNoticeDeliveryRequest
{
    internal ScreeningNoticeDeliveryRequest(long adverseActionId, long organizationId, long screeningOrderId, long rentalApplicationId,
        int attemptNumber, ScreeningAdverseActionDeliveryChannel channel, string immutableContent, string contentHash,
        string providerIdempotencyKey)
    {
        AdverseActionId = adverseActionId; OrganizationId = organizationId; ScreeningOrderId = screeningOrderId;
        RentalApplicationId = rentalApplicationId; AttemptNumber = attemptNumber; Channel = channel;
        ImmutableContent = immutableContent; NoticeContentSha256Hash = contentHash;
        ProviderIdempotencyKey = providerIdempotencyKey;
    }
    public long AdverseActionId { get; }
    public long OrganizationId { get; }
    public long ScreeningOrderId { get; }
    public long RentalApplicationId { get; }
    public int AttemptNumber { get; }
    public ScreeningAdverseActionDeliveryChannel Channel { get; }
    internal string ImmutableContent { get; }
    public string NoticeContentSha256Hash { get; }
    public string ProviderIdempotencyKey { get; }
    public override string ToString() => $"ScreeningNoticeDeliveryRequest {{ Correlation = [REDACTED], Attempt = {AttemptNumber}, Channel = {Channel}, Content = [REDACTED] }}";
}

public sealed record ScreeningNoticeDeliveryOutcome(ScreeningDeliveryAttemptStatus Status, string? DeliveryReference,
    DateTimeOffset? DeliveredAt, string? FailureCode)
{
    public override string ToString() => $"ScreeningNoticeDeliveryOutcome {{ Status = {Status}, DeliveryReference = [REDACTED], DeliveredAt = {DeliveredAt:O}, Failure = [REDACTED] }}";
}
public interface IScreeningNoticeDelivery
{
    Task<ScreeningNoticeDeliveryOutcome> DeliverAsync(ScreeningNoticeDeliveryRequest request, CancellationToken cancellationToken = default);
}

public sealed record ScreeningAdverseActionResult(long AdverseActionId, ScreeningAdverseActionType ActionType,
    ScreeningDeliveryAttemptStatus DeliveryStatus, int AttemptNumber, DateTimeOffset CreatedAt)
{
    public override string ToString() => $"ScreeningAdverseActionResult {{ Id = [REDACTED], ActionType = {ActionType}, DeliveryStatus = {DeliveryStatus}, Attempt = {AttemptNumber}, CreatedAt = {CreatedAt:O} }}";
}
public sealed record ApplicantAdverseActionNoticeSummary(ScreeningAdverseActionType ActionType, DateTimeOffset CreatedAt,
    IReadOnlyList<string> ReasonCodes, ScreeningDeliveryAttemptStatus DeliveryStatus, DateTimeOffset? DeliveredAt,
    ScreeningReconsiderationStatus ReconsiderationStatus, string SupportPath,
    string NoticeVersion, string NoticeContentSha256Hash, string ImmutableNoticeContent,
    string CraName, string CraAddress, string CraPhone, string CraDidNotDecideStatement,
    string DisputeRightsStatement, string FreeCopyRightsStatement, string JurisdictionCode,
    string JurisdictionDisclosureVersion, string JurisdictionDisclosure)
{
    public override string ToString() => $"ApplicantAdverseActionNoticeSummary {{ ActionType = {ActionType}, CreatedAt = {CreatedAt:O}, Details = [REDACTED] }}";
}
public sealed record ScreeningReconsiderationResult(long AdverseActionId, long Revision, ScreeningReconsiderationStatus Status,
    DateTimeOffset OccurredAt, long? NewDecisionRevisionId, string Message)
{
    public override string ToString() => $"ScreeningReconsiderationResult {{ AdverseActionId = [REDACTED], Revision = {Revision}, Status = {Status}, OccurredAt = {OccurredAt:O} }}";
}

public interface ITenantScreeningAdverseActionService
{
    Task<ScreeningAdverseActionResult> CreateAndDeliverAsync(CreateScreeningAdverseActionCommand command, CancellationToken cancellationToken = default);
    Task<ScreeningAdverseActionResult> RetryDeliveryAsync(RetryScreeningAdverseActionDeliveryCommand command, CancellationToken cancellationToken = default);
    Task<ScreeningReconsiderationResult> RequestReconsiderationAsync(ScreeningReconsiderationCommand command, CancellationToken cancellationToken = default);
    Task<ScreeningReconsiderationResult> ResolveReconsiderationAsync(ResolveScreeningReconsiderationCommand command, CancellationToken cancellationToken = default);
    Task<ApplicantAdverseActionNoticeSummary> GetApplicantNoticeAsync(string rawToken, CancellationToken cancellationToken = default);
    Task<ScreeningReconsiderationResult> RequestApplicantReconsiderationAsync(string rawToken, string reason, CancellationToken cancellationToken = default);
}

public sealed record ScreeningReportDeletionClaim(long OrganizationId, long ReportRevisionId, Guid ClaimToken,
    DateTimeOffset LeaseExpiresAt, long ScreeningOrderId)
{
    public string ProviderIdempotencyKey => ScreeningReportDeletionRequest.CreateProviderIdempotencyKey(
        OrganizationId, ScreeningOrderId, ReportRevisionId);
    public override string ToString() => $"ScreeningReportDeletionClaim {{ OrganizationId = [REDACTED], ReportRevisionId = [REDACTED], ClaimToken = [REDACTED], LeaseExpiresAt = {LeaseExpiresAt:O} }}";
}

public interface ITenantScreeningRetentionService
{
    Task<int> DeleteDueReportsAsync(long organizationId, CancellationToken cancellationToken = default);
    Task<ScreeningReportDeletionClaim?> ClaimNextDueReportAsync(long organizationId, CancellationToken cancellationToken = default);
    Task<bool> ExecuteClaimAsync(ScreeningReportDeletionClaim claim, CancellationToken cancellationToken = default);
    Task PlaceLegalHoldAsync(long organizationId, long reportRevisionId, string reasonCode,
        CancellationToken cancellationToken = default);
}

public sealed class ScreeningDeletionSafetyConflictException()
    : Exception("A preservation request conflicted with an external report deletion already in flight. The conflict was recorded for incident response.");

public sealed record ScreeningIncidentRecord(long? OrganizationId, long? ScreeningOrderId, string? ProviderKey,
    string? ProviderEventId, ScreeningIncidentType IncidentType, ScreeningIncidentSeverity Severity, string DetectionSource,
    string AffectedResource, string? FailureEvidenceReference, string? RemediationEvidenceReference, string? NotificationEvidenceReference)
{
    public override string ToString() => $"ScreeningIncidentRecord {{ Type = {IncidentType}, Severity = {Severity}, Correlation = [REDACTED], Resource = [REDACTED], Evidence = [REDACTED] }}";
}
public interface IScreeningIncidentRecorder
{
    Task<ScreeningIncident> RecordAsync(ScreeningIncidentRecord record, CancellationToken cancellationToken = default);
    Task<ScreeningIncidentEvent> ChangeStatusAsync(long incidentId, ScreeningIncidentStatus status, long? actorUserId,
        string? evidenceReference, CancellationToken cancellationToken = default);
}
