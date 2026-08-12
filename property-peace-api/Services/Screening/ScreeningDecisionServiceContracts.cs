using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.Screening;

public sealed record RecordScreeningReportRevisionCommand(string ProviderKey, string ProviderOrderId,
    string ProviderReportReference, string ReportVersion, ScreeningReportStatus Status,
    IReadOnlyDictionary<string, string> NormalizedFacts, long? SupersedesScreeningReportRevisionId,
    TimeSpan RetentionPeriod, DateTimeOffset ProviderOccurredAt, DateTimeOffset RetrievedAt,
    ScreeningReportRetentionSignal RetentionSignal);

public sealed record RecordHumanScreeningDecisionCommand(long OrganizationId, long ActorUserId, long ScreeningOrderId,
    ScreeningRentalDecision Decision, string CriteriaVersion, long? ReliedUponScreeningReportRevisionId,
    IReadOnlyList<string> ReasonCodes);

public sealed record ScreeningDisputeOpenCommand
{
    private ScreeningDisputeOpenCommand(long? organizationId, long? actorUserId, string? applicantToken,
        long? screeningOrderId, long reportRevisionId, IReadOnlyList<string> issueCodes, string narrative)
    { OrganizationId = organizationId; ActorUserId = actorUserId; ApplicantToken = applicantToken; ScreeningOrderId = screeningOrderId;
      ReportRevisionId = reportRevisionId; IssueCodes = issueCodes; Narrative = narrative; }
    public static ScreeningDisputeOpenCommand ForStaff(long organizationId, long actorUserId, long orderId,
        long reportRevisionId, IReadOnlyList<string> issueCodes, string narrative) =>
        new(organizationId, actorUserId, null, orderId, reportRevisionId, issueCodes, narrative);
    public static ScreeningDisputeOpenCommand ForApplicant(string rawToken, long reportRevisionId,
        IReadOnlyList<string> issueCodes, string narrative) => new(null, null, rawToken, null, reportRevisionId, issueCodes, narrative);
    public long? OrganizationId { get; }
    public long? ActorUserId { get; }
    internal string? ApplicantToken { get; }
    public long? ScreeningOrderId { get; }
    public long ReportRevisionId { get; }
    public IReadOnlyList<string> IssueCodes { get; }
    internal string Narrative { get; }
    public override string ToString() => "ScreeningDisputeOpenCommand { Correlation = [REDACTED], Issues = [REDACTED], Narrative = [REDACTED] }";
}

public sealed record ScreeningDisputeUpdateCommand(long DisputeId, string ProviderKey, string ProviderEventReference,
    ScreeningDisputeStatus Status, ScreeningStatus OrderStatus, long? CorrectedReportRevisionId,
    DateTimeOffset OccurredAt, string ProviderEventType);

public sealed record ScreeningOrderCancellationCommand(long OrganizationId, long ActorUserId, long ScreeningOrderId, string ReasonCode);

public sealed record ScreeningDecisionResult(long DecisionRevisionId, long Revision, ScreeningRentalDecision Decision,
    IReadOnlyList<string> ReasonCodes, DateTimeOffset CreatedAt)
{
    public override string ToString() => $"ScreeningDecisionResult {{ DecisionRevisionId = [REDACTED], Revision = {Revision}, Decision = {Decision} }}";
}
public sealed record ScreeningDisputeResult(long DisputeId, ScreeningDisputeStatus Status, DateTimeOffset OpenedAt,
    DateTimeOffset? ResolvedAt, IReadOnlyList<string> IssueCodes)
{
    public override string ToString() => $"ScreeningDisputeResult {{ DisputeId = [REDACTED], Status = {Status}, OpenedAt = {OpenedAt:O} }}";
}

public sealed record IssueScreeningSupportElevationCommand(long OrganizationId, long ApprovedByUserId, long SubjectUserId,
    string CaseReference, string Reason, ScreeningReportAccessPurpose Purpose, TimeSpan Lifetime, int MaximumAccessCount = 1);
public sealed record ScreeningSupportElevationResult(long ElevationId, ScreeningReportAccessPurpose Purpose,
    DateTimeOffset IssuedAt, DateTimeOffset ExpiresAt, int MaximumAccessCount, int AccessCount, bool Revoked)
{
    public override string ToString() => $"ScreeningSupportElevationResult {{ ElevationId = [REDACTED], Purpose = {Purpose}, IssuedAt = {IssuedAt:O}, ExpiresAt = {ExpiresAt:O}, Revoked = {Revoked} }}";
}
public interface IScreeningSupportAuthorization
{
    Task<bool> IsPlatformSupportActorAsync(long userId, CancellationToken cancellationToken = default);
}
public interface IScreeningSupportElevationService
{
    Task<ScreeningSupportElevationResult> IssueAsync(IssueScreeningSupportElevationCommand command, CancellationToken cancellationToken = default);
    Task RevokeAsync(long organizationId, long actorUserId, long elevationId, CancellationToken cancellationToken = default);
}

public interface ITenantScreeningDecisionService
{
    Task<ScreeningReportRevision> RecordReportRevisionAsync(RecordScreeningReportRevisionCommand command, CancellationToken cancellationToken = default);
    Task<ScreeningReportAccessResult> RequestReportAccessAsync(long organizationId, long actorUserId, long orderId,
        ScreeningReportAccessPurpose purpose, long? elevationId = null, CancellationToken cancellationToken = default);
    Task<ScreeningReportAccessResult> RequestApplicantReportAccessAsync(string rawToken,
        ScreeningReportAccessPurpose purpose, CancellationToken cancellationToken = default);
    Task<ScreeningRentalDecisionRevision> RecordHumanDecisionAsync(RecordHumanScreeningDecisionCommand command, CancellationToken cancellationToken = default);
    Task<ScreeningDispute> OpenDisputeAsync(ScreeningDisputeOpenCommand command, CancellationToken cancellationToken = default);
    Task<int> ProcessPendingDisputeIntentsAsync(int batchSize, TimeSpan leaseDuration,
        CancellationToken cancellationToken = default);
    Task<ScreeningDisputeEvent> RecordDisputeUpdateAsync(ScreeningDisputeUpdateCommand command, CancellationToken cancellationToken = default);
    Task CancelOrExpireAsync(ScreeningOrderCancellationCommand command, CancellationToken cancellationToken = default);
    Task<int> ProcessPendingCancellationIntentsAsync(int batchSize, TimeSpan leaseDuration,
        CancellationToken cancellationToken = default);
    Task<int> RecoverStaleReportAccessAttemptsAsync(int batchSize, TimeSpan staleAge,
        CancellationToken cancellationToken = default);
}
