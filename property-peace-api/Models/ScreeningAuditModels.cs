using brownstone_hub_api.Domain.Screening;

namespace brownstone_hub_api.Models;

public enum ScreeningReportStatus
{
    Received = 1,
    Complete = 2,
    Corrected = 3,
    Superseded = 4
}

public enum ScreeningRentalDecision
{
    Approved = 1,
    Denied = 2,
    Conditional = 3,
    Deferred = 4
}

public enum ScreeningDecisionDisputeStatus
{
    None = 1,
    Frozen = 2,
    Released = 3
}

public enum ScreeningDisputeStatus
{
    Open = 1,
    Submitted = 2,
    Investigating = 3,
    Resolved = 4,
    Rejected = 5
}

public enum ScreeningDisputeActorType
{
    Applicant = 1,
    AuthorizedRepresentative = 2,
    OrganizationUser = 3,
    Provider = 4
}

public enum ScreeningAdverseActionDeliveryChannel
{
    Email = 1,
    PostalMail = 2,
    Sms = 3
}

public enum ScreeningDeliveryAttemptStatus
{
    Requested = 1,
    Delivered = 2,
    Failed = 3,
    DeadLettered = 4
}

public enum ScreeningReportDeletionEventType
{
    Claimed = 1,
    ReclaimedAfterLeaseExpiry = 2,
    RevokedForLegalHold = 3,
    RevokedForDispute = 4,
    ProviderCallStarted = 5,
    ProviderDeletionConfirmed = 6,
    HoldRacedWithProviderDeletion = 7,
    DisputeRacedWithProviderDeletion = 8,
    ProviderOutcomeAmbiguous = 9,
    ProviderDeletionReconciled = 10,
    ManualOutcomeRequired = 11
}

/// <summary>
/// Append-only provider-neutral report evidence. It deliberately stores only bounded
/// normalized facts and their digest, never a provider report document or location.
/// </summary>
public sealed class ScreeningReportRevision
{
    public long Id { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public long Revision { get; internal set; }
    public string ProviderKey { get; internal set; } = string.Empty;
    public string ProviderReportReference { get; internal set; } = string.Empty;
    public DateTimeOffset ReceivedAt { get; internal set; }
    public DateTimeOffset ProviderOccurredAt { get; internal set; }
    public DateTimeOffset? CorrectedAt { get; internal set; }
    public ScreeningReportStatus Status { get; internal set; }
    public string ReportVersion { get; internal set; } = string.Empty;
    public string NormalizedFactsJson { get; internal set; } = "{}";
    public string NormalizedFactsSha256Hash { get; internal set; } = string.Empty;
    public long? SupersedesScreeningReportRevisionId { get; internal set; }
    public DateTimeOffset RetentionExpiresAt { get; internal set; }
    public ScreeningReportRetentionSignal RetentionSignal { get; internal set; }
    public DateTimeOffset? DeleteRequestedAt { get; internal set; }
    public DateTimeOffset? DeletedAt { get; internal set; }
    public bool IsUnderLegalHold { get; internal set; }
    public DateTimeOffset? LegalHoldPlacedAt { get; internal set; }
    public DateTimeOffset? LegalHoldReleasedAt { get; internal set; }
    public string? LegalHoldReasonCode { get; internal set; }
    /// <summary>Opaque, short-lived ownership token and optimistic-concurrency boundary.</summary>
    public Guid? DeletionClaimToken { get; internal set; }
    public DateTimeOffset? DeletionClaimedAt { get; internal set; }
    public DateTimeOffset? DeletionClaimExpiresAt { get; internal set; }
    public DateTimeOffset? DeletionProviderCallStartedAt { get; internal set; }
    /// <summary>Durable preservation fence installed before dispute provider work.</summary>
    public Guid? PendingDisputeOperationId { get; internal set; }
}

/// <summary>Append-only, sanitized evidence for report-deletion safety transitions.</summary>
public sealed class ScreeningReportDeletionEvent
{
    public long Id { get; internal set; }
    public long ScreeningReportRevisionId { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public long Revision { get; internal set; }
    public ScreeningReportDeletionEventType EventType { get; internal set; }
    public DateTimeOffset OccurredAt { get; internal set; }
    public string? ReasonCode { get; internal set; }
}

/// <summary>An append-only human rental decision; no automatic decision output is persisted.</summary>
public sealed class ScreeningRentalDecisionRevision
{
    public long Id { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public long RentalApplicationId { get; internal set; }
    public long Revision { get; internal set; }
    public long DecisionActorUserId { get; internal set; }
    public ScreeningRentalDecision Decision { get; internal set; }
    public string CriteriaVersion { get; internal set; } = string.Empty;
    public string CriteriaSnapshotSha256Hash { get; internal set; } = string.Empty;
    public long? ReliedUponScreeningReportRevisionId { get; internal set; }
    public string ReasonCodesJson { get; internal set; } = "[]";
    public DateTimeOffset CreatedAt { get; internal set; }
    public long? SupersedesScreeningRentalDecisionRevisionId { get; internal set; }
    public bool IsFrozenByDispute { get; internal set; }
    public ScreeningDecisionDisputeStatus DisputeStatus { get; internal set; }
}

/// <summary>Dispute aggregate with bounded classifications and a digest in place of narrative text.</summary>
public sealed class ScreeningDispute
{
    public long Id { get; internal set; }
    /// <summary>Stable local provider idempotency key; contains no applicant information.</summary>
    public Guid LocalDisputeId { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public string ProviderKey { get; internal set; } = string.Empty;
    public string ProviderDisputeReference { get; internal set; } = string.Empty;
    public ScreeningDisputeStatus Status { get; internal set; }
    public DateTimeOffset OpenedAt { get; internal set; }
    public DateTimeOffset? ResolvedAt { get; internal set; }
    public long OriginalScreeningReportRevisionId { get; internal set; }
    public long? CorrectedScreeningReportRevisionId { get; internal set; }
    public ScreeningDisputeActorType? OpenedByActorType { get; internal set; }
    public long? OpenedByUserId { get; internal set; }
    public string IssueCodesJson { get; internal set; } = "[]";
    public string NotesSha256Hash { get; internal set; } = string.Empty;
    public DateTimeOffset RetentionExpiresAt { get; internal set; }
}

public enum ScreeningDisputeIntentStatus
{
    Pending = 1,
    Processing = 2,
    ProviderAccepted = 3,
    Completed = 4,
    DeadLettered = 5
}

/// <summary>Durable provider-neutral dispute outbox and preservation intent.</summary>
public sealed class ScreeningDisputeIntent
{
    public long Id { get; internal set; }
    public Guid OperationId { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public long RentalApplicationId { get; internal set; }
    public long ScreeningReportRevisionId { get; internal set; }
    public string ProviderKey { get; internal set; } = string.Empty;
    public string ProviderOrderId { get; internal set; } = string.Empty;
    public string ProviderReportReference { get; internal set; } = string.Empty;
    public ScreeningDisputeActorType ActorType { get; internal set; }
    public long? ActorUserId { get; internal set; }
    public string IssueCodesJson { get; internal set; } = "[]";
    public string NotesSha256Hash { get; internal set; } = string.Empty;
    public DateTimeOffset RetentionExpiresAt { get; internal set; }
    public ScreeningDisputeIntentStatus Status { get; private set; } = ScreeningDisputeIntentStatus.Pending;
    public int Attempts { get; private set; }
    public Guid? ProcessingLeaseId { get; private set; }
    public DateTimeOffset? ProcessingLeaseUntil { get; private set; }
    public DateTimeOffset? NextAttemptAt { get; private set; }
    public DateTimeOffset CreatedAt { get; internal set; }
    public DateTimeOffset? ProviderAcceptedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public string? ProviderReference { get; private set; }
    public string? FailureCode { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    internal bool TryClaim(Guid leaseId, DateTimeOffset now, DateTimeOffset leaseUntil, int maximumAttempts = int.MaxValue)
    {
        if (maximumAttempts <= 0) throw new ArgumentOutOfRangeException(nameof(maximumAttempts));
        if (leaseId == Guid.Empty || leaseUntil <= now || Attempts >= maximumAttempts || NextAttemptAt > now ||
            Status is ScreeningDisputeIntentStatus.Completed or ScreeningDisputeIntentStatus.ProviderAccepted or
            ScreeningDisputeIntentStatus.DeadLettered ||
            (Status == ScreeningDisputeIntentStatus.Processing && ProcessingLeaseUntil > now)) return false;
        Status = ScreeningDisputeIntentStatus.Processing;
        ProcessingLeaseId = leaseId;
        ProcessingLeaseUntil = leaseUntil;
        Attempts++;
        NextAttemptAt = null;
        FailureCode = null;
        return true;
    }

    internal void MarkProviderOutcomeUnknown()
    {
        if (Status != ScreeningDisputeIntentStatus.Processing) return;
        Status = ScreeningDisputeIntentStatus.Pending;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        FailureCode = "ProviderOutcomeUnknown";
    }

    internal void MarkProviderRejected()
    {
        if (Status != ScreeningDisputeIntentStatus.Processing) return;
        Status = ScreeningDisputeIntentStatus.Pending;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        FailureCode = "ProviderRejected";
    }

    internal bool ScheduleRetryOrDeadLetter(string failureCode, DateTimeOffset now,
        DateTimeOffset nextAttemptAt, int maximumAttempts)
    {
        ScreeningContractValidation.ValidateBoundedText(failureCode, 100, nameof(failureCode), false);
        if (maximumAttempts <= 0) throw new ArgumentOutOfRangeException(nameof(maximumAttempts));
        if (Status != ScreeningDisputeIntentStatus.Processing) return false;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        FailureCode = failureCode;
        if (Attempts >= maximumAttempts)
        {
            Status = ScreeningDisputeIntentStatus.DeadLettered;
            CompletedAt = now;
            NextAttemptAt = null;
            return true;
        }
        Status = ScreeningDisputeIntentStatus.Pending;
        NextAttemptAt = nextAttemptAt;
        return false;
    }

    internal bool FinalizeExpiredLeaseAtBound(DateTimeOffset now, int maximumAttempts)
    {
        if (maximumAttempts <= 0) throw new ArgumentOutOfRangeException(nameof(maximumAttempts));
        if (Status != ScreeningDisputeIntentStatus.Processing || ProcessingLeaseUntil is null ||
            ProcessingLeaseUntil > now || Attempts < maximumAttempts) return false;
        return ScheduleRetryOrDeadLetter("ProviderOutcomeUnknown", now, now.AddTicks(1), maximumAttempts);
    }

    internal void MarkProviderAccepted(string providerReference, DateTimeOffset now)
    {
        ScreeningContractValidation.ValidateBoundedText(providerReference, 200, nameof(providerReference), false);
        if (Status != ScreeningDisputeIntentStatus.Processing)
            throw new InvalidOperationException("Only a claimed dispute intent may be accepted.");
        Status = ScreeningDisputeIntentStatus.ProviderAccepted;
        ProviderReference = providerReference;
        ProviderAcceptedAt = now;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        FailureCode = null;
    }

    internal void MarkCompleted(DateTimeOffset now)
    {
        if (Status != ScreeningDisputeIntentStatus.ProviderAccepted)
            throw new InvalidOperationException("Only a provider-accepted dispute intent may be completed.");
        Status = ScreeningDisputeIntentStatus.Completed;
        CompletedAt = now;
    }

    public override string ToString() =>
        $"ScreeningDisputeIntent {{ Id = [REDACTED], Status = {Status}, Attempts = {Attempts}, Correlation = [REDACTED], Provider = [REDACTED], Issues = [REDACTED] }}";
}

/// <summary>Append-only, provider-neutral dispute timeline.</summary>
public sealed class ScreeningDisputeEvent
{
    public long Id { get; internal set; }
    public long ScreeningDisputeId { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public long Revision { get; internal set; }
    public ScreeningDisputeStatus Status { get; internal set; }
    public DateTimeOffset OccurredAt { get; internal set; }
    public DateTimeOffset RecordedAt { get; internal set; }
    public string? ProviderEventType { get; internal set; }
    public string? ProviderEventReference { get; internal set; }
    public ScreeningDisputeActorType? ActorType { get; internal set; }
    public long? ActorUserId { get; internal set; }
}

/// <summary>Durable delivery intent and its bounded result. Raw exceptions and resource locations are forbidden.</summary>
public sealed class ScreeningAdverseActionDeliveryAttempt
{
    public long Id { get; internal set; }
    public long ScreeningAdverseActionId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public int AttemptNumber { get; internal set; }
    public ScreeningAdverseActionDeliveryChannel Channel { get; internal set; }
    public DateTimeOffset AttemptedAt { get; internal set; }
    public DateTimeOffset? DeliveredAt { get; internal set; }
    public ScreeningDeliveryAttemptStatus Status { get; internal set; }
    public string? ProviderDeliveryReference { get; internal set; }
    public string? FailureCode { get; internal set; }
    public string NoticeContentSha256Hash { get; internal set; } = string.Empty;
    /// <summary>Stable opaque key supplied on every replay of this logical provider request.</summary>
    public string ProviderIdempotencyKey { get; internal set; } = string.Empty;
    public Guid? ProcessingLeaseId { get; internal set; }
    public DateTimeOffset? ProcessingLeaseUntil { get; internal set; }
    public DateTimeOffset? NextAttemptAt { get; internal set; }
    public byte[] RowVersion { get; private set; } = [];

    internal void MarkRequested(DateTimeOffset requestedAt)
    {
        Status = ScreeningDeliveryAttemptStatus.Requested;
        AttemptedAt = requestedAt;
        DeliveredAt = null;
        ProviderDeliveryReference = null;
        FailureCode = null;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        NextAttemptAt = null;
    }

    internal void MarkDelivered(string? reference, DateTimeOffset deliveredAt)
    {
        Status = ScreeningDeliveryAttemptStatus.Delivered;
        DeliveredAt = deliveredAt;
        ProviderDeliveryReference = reference;
        FailureCode = null;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        NextAttemptAt = null;
    }

    internal bool TryAcquireRecoveryLease(Guid leaseId, DateTimeOffset now, DateTimeOffset leaseUntil)
    {
        if (leaseId == Guid.Empty || leaseUntil <= now) throw new ArgumentOutOfRangeException(nameof(leaseId));
        if (Status is not (ScreeningDeliveryAttemptStatus.Requested or ScreeningDeliveryAttemptStatus.Failed) ||
            NextAttemptAt > now || ProcessingLeaseUntil > now) return false;
        ProcessingLeaseId = leaseId;
        ProcessingLeaseUntil = leaseUntil;
        return true;
    }

    internal bool ScheduleFailure(string failureCode, DateTimeOffset now, DateTimeOffset nextAttemptAt,
        int maximumAttempts)
    {
        if (maximumAttempts <= 0) throw new ArgumentOutOfRangeException(nameof(maximumAttempts));
        if (nextAttemptAt <= now) throw new ArgumentOutOfRangeException(nameof(nextAttemptAt));
        MarkFailed(failureCode);
        if (AttemptNumber >= maximumAttempts)
        {
            MarkDeadLettered();
            return true;
        }
        NextAttemptAt = nextAttemptAt;
        return false;
    }

    internal void ReleaseRecoveryLease()
    {
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
    }

    internal void MarkFailed(string failureCode)
    {
        Status = ScreeningDeliveryAttemptStatus.Failed;
        DeliveredAt = null;
        ProviderDeliveryReference = null;
        FailureCode = failureCode;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
    }

    internal void MarkDeadLettered()
    {
        Status = ScreeningDeliveryAttemptStatus.DeadLettered;
        FailureCode = "MaximumDeliveryAttemptsExceeded";
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        NextAttemptAt = null;
    }

    public override string ToString() => $"ScreeningAdverseActionDeliveryAttempt {{ Id = [REDACTED], Status = {Status}, Attempt = {AttemptNumber}, Channel = {Channel}, Evidence = [REDACTED] }}";
}

/// <summary>Append-only reconsideration status history.</summary>
public sealed class ScreeningReconsiderationEvent
{
    public long Id { get; internal set; }
    public long ScreeningAdverseActionId { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public long Revision { get; internal set; }
    public ScreeningReconsiderationStatus FromStatus { get; internal set; }
    public ScreeningReconsiderationStatus ToStatus { get; internal set; }
    public DateTimeOffset OccurredAt { get; internal set; }
    public DateTimeOffset RecordedAt { get; internal set; }
    public long ActorUserId { get; internal set; }
    public string ReasonSha256Hash { get; internal set; } = string.Empty;
    public long? NewScreeningRentalDecisionRevisionId { get; internal set; }
}
