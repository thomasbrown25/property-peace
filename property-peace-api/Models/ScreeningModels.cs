using brownstone_hub_api.Domain.Screening;

namespace brownstone_hub_api.Models;

public enum ScreeningTransitionSource
{
    System = 1,
    ProviderWebhook = 2,
    ProviderPolling = 3,
    User = 4
}

public enum ScreeningConsentActorType
{
    Applicant = 1,
    AuthorizedRepresentative = 2
}

public enum ScreeningPaymentEvidenceSource
{
    HostedPaymentBoundary = 1,
    ProviderWebhook = 2,
    ProviderPolling = 3,
    ServerBillingResponsibility = 4
}

/// <summary>Append-only, quote-bound commercial evidence. Payment credentials are deliberately absent.</summary>
public sealed class ScreeningPaymentEvidence
{
    public long Id { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public ScreeningPayer Payer { get; internal set; }
    public long LandlordAmountMinor { get; internal set; }
    public long ApplicantAmountMinor { get; internal set; }
    public long ProviderAmountMinor { get; internal set; }
    public long PlatformFeeMinor { get; internal set; }
    public long TaxAmountMinor { get; internal set; }
    public long TotalAmountMinor { get; internal set; }
    public string Currency { get; internal set; } = string.Empty;
    public string QuoteReferenceHash { get; internal set; } = string.Empty;
    public string PaymentOperationReferenceHash { get; internal set; } = string.Empty;
    public ScreeningPaymentEventStatus Status { get; internal set; }
    public ScreeningPaymentEvidenceSource Source { get; internal set; }
    public long? ActorUserId { get; internal set; }
    public long Revision { get; internal set; }
    public DateTimeOffset ProviderOccurredAt { get; internal set; }
    public DateTimeOffset RecordedAt { get; internal set; }
    public string? FailureCode { get; internal set; }
    public override string ToString() => $"ScreeningPaymentEvidence {{ Id = [REDACTED], Status = {Status}, Revision = {Revision}, Payer = {Payer}, Amounts = [REDACTED], References = [REDACTED], Failure = [REDACTED] }}";
}

public enum ScreeningInboxProcessingStatus
{
    Pending = 1,
    Processing = 2,
    Processed = 3,
    RetryScheduled = 4,
    DeadLettered = 5,
    Stale = 6
}

public enum ScreeningAdverseActionType
{
    PreAdverseAction = 1,
    FinalAdverseAction = 2
}

public enum ScreeningNoticeDeliveryStatus
{
    Pending = 1,
    Delivered = 2,
    Failed = 3
}

public enum ScreeningReconsiderationStatus
{
    NotRequested = 1,
    Requested = 2,
    UnderReview = 3,
    Resolved = 4
}

public enum ScreeningIncidentType
{
    WebhookIntegrityConflict = 1,
    WebhookDeadLetter = 2,
    DeliveryFailure = 3,
    ProviderDeletionFailure = 4,
    ProviderDeletionHoldConflict = 5,
    ProviderDeletionDisputeConflict = 6,
    StaleProviderPollingState = 7,
    AdverseActionDeliveryDeadLetter = 8,
    CancellationRecoveryDeadLetter = 9,
    DisputeRecoveryDeadLetter = 10
}
public enum ScreeningIncidentSeverity { Low = 1, Medium = 2, High = 3, Critical = 4 }
public enum ScreeningIncidentStatus { Detected = 1, Contained = 2, Resolved = 3 }

public enum ScreeningCancellationIntentStatus
{
    Pending = 1,
    Processing = 2,
    ProviderAccepted = 3,
    Completed = 4,
    SupersededByCompletion = 5,
    RejectedByOrderState = 6,
    ManualReview = 7
}

/// <summary>
/// Durable provider-neutral cancellation outbox. It contains only bounded correlation and
/// classification data; provider payloads, applicant identity, and exception text are forbidden.
/// </summary>
public sealed class ScreeningCancellationIntent
{
    public long Id { get; internal set; }
    public Guid OperationId { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public long RentalApplicationId { get; internal set; }
    public long ActorUserId { get; internal set; }
    public long ExpectedOrderRevision { get; internal set; }
    public string ProviderKey { get; internal set; } = string.Empty;
    public string? ProviderOrderId { get; internal set; }
    public string ReasonCode { get; internal set; } = string.Empty;
    public ScreeningCancellationIntentStatus Status { get; private set; } = ScreeningCancellationIntentStatus.Pending;
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
            Status is ScreeningCancellationIntentStatus.Completed or ScreeningCancellationIntentStatus.SupersededByCompletion or
            ScreeningCancellationIntentStatus.RejectedByOrderState or ScreeningCancellationIntentStatus.ProviderAccepted or
            ScreeningCancellationIntentStatus.ManualReview ||
            (Status == ScreeningCancellationIntentStatus.Processing && ProcessingLeaseUntil > now)) return false;
        Status = ScreeningCancellationIntentStatus.Processing;
        ProcessingLeaseId = leaseId;
        ProcessingLeaseUntil = leaseUntil;
        Attempts++;
        NextAttemptAt = null;
        FailureCode = null;
        return true;
    }

    internal bool ReleaseForRetry(string failureCode, DateTimeOffset now = default,
        DateTimeOffset? nextAttemptAt = null, int maximumAttempts = int.MaxValue)
    {
        ScreeningContractValidation.ValidateBoundedText(failureCode, 100, nameof(failureCode), false);
        if (maximumAttempts <= 0) throw new ArgumentOutOfRangeException(nameof(maximumAttempts));
        if (Status != ScreeningCancellationIntentStatus.Processing) return false;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        FailureCode = failureCode;
        if (Attempts >= maximumAttempts)
        {
            Status = ScreeningCancellationIntentStatus.ManualReview;
            NextAttemptAt = null;
            CompletedAt = now == default ? DateTimeOffset.UtcNow : now;
            return true;
        }
        Status = ScreeningCancellationIntentStatus.Pending;
        NextAttemptAt = nextAttemptAt;
        return false;
    }

    internal bool FinalizeExpiredLeaseAtBound(DateTimeOffset now, int maximumAttempts)
    {
        if (maximumAttempts <= 0) throw new ArgumentOutOfRangeException(nameof(maximumAttempts));
        if (Status != ScreeningCancellationIntentStatus.Processing || ProcessingLeaseUntil is null ||
            ProcessingLeaseUntil > now || Attempts < maximumAttempts) return false;
        return ReleaseForRetry("ProviderOutcomeUnknown", now, null, maximumAttempts);
    }

    internal void MarkProviderOutcomeUnknown()
    {
        if (Status is not (ScreeningCancellationIntentStatus.Processing or ScreeningCancellationIntentStatus.ProviderAccepted)) return;
        Status = ScreeningCancellationIntentStatus.Pending;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        ProviderAcceptedAt = null;
        ProviderReference = null;
        CompletedAt = null;
        FailureCode = "ProviderOutcomeUnknown";
    }

    internal void MarkProviderAccepted(string providerReference, DateTimeOffset now)
    {
        ScreeningContractValidation.ValidateBoundedText(providerReference, 200, nameof(providerReference), false);
        if (Status != ScreeningCancellationIntentStatus.Processing) throw new InvalidOperationException("Only a claimed cancellation may be accepted.");
        Status = ScreeningCancellationIntentStatus.ProviderAccepted;
        ProviderReference = providerReference;
        ProviderAcceptedAt = now;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        FailureCode = null;
    }

    internal void MarkCompleted(DateTimeOffset now) => Finish(ScreeningCancellationIntentStatus.Completed, now);
    internal void MarkCompletionWon(DateTimeOffset now) => Finish(ScreeningCancellationIntentStatus.SupersededByCompletion, now);
    internal void MarkRejectedByOrderState(DateTimeOffset now) => Finish(ScreeningCancellationIntentStatus.RejectedByOrderState, now);
    internal void AttachLateProviderOrder(string providerOrderId)
    {
        ScreeningContractValidation.ValidateBoundedText(providerOrderId, 200, nameof(providerOrderId), false);
        if (ProviderOrderId is not null && !string.Equals(ProviderOrderId, providerOrderId, StringComparison.Ordinal))
            throw new InvalidOperationException("Cancellation provider correlation cannot be changed.");
        if (ProviderOrderId is not null) return;
        ProviderOrderId = providerOrderId;
        if (Status == ScreeningCancellationIntentStatus.Completed)
        {
            Status = ScreeningCancellationIntentStatus.Pending;
            CompletedAt = null;
            ProviderAcceptedAt = null;
            ProviderReference = null;
        }
    }
    private void Finish(ScreeningCancellationIntentStatus status, DateTimeOffset now)
    {
        Status = status;
        CompletedAt = now;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
    }

    public override string ToString() => $"ScreeningCancellationIntent {{ Id = [REDACTED], Status = {Status}, Attempts = {Attempts}, Correlation = [REDACTED], Provider = [REDACTED], Failure = [REDACTED] }}";
}

/// <summary>
/// Provider-neutral order state and immutable commercial/compliance snapshots.
/// Applicant identity is the rental application plus an optional one-way access-identity hash.
/// </summary>
public sealed class TenantScreeningOrder
{
    public long Id { get; internal set; }
    public long OrganizationId { get; internal set; }
    public long RentalApplicationId { get; internal set; }
    public long PropertyId { get; internal set; }
    public long? UnitId { get; internal set; }
    public long? ListingId { get; internal set; }
    /// <summary>Scoped SHA-256 digest. The raw applicant access token is never persisted.</summary>
    public string? ApplicantAccessTokenHash { get; internal set; }
    /// <summary>Expiry of the applicant capability, deliberately independent of quote expiry.</summary>
    public DateTimeOffset? ApplicantAccessExpiresAt { get; internal set; }
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    [Obsolete("Use ApplicantAccessExpiresAt.")]
    public DateTimeOffset? ApplicantAccessTokenExpiresAt { get => ApplicantAccessExpiresAt; internal set => ApplicantAccessExpiresAt = value; }
    /// <summary>SHA-256 of the authenticated organization scope and client key. The raw key is never stored.</summary>
    public string InvitationIdempotencyKeyHash { get; internal set; } = string.Empty;

    public ScreeningStatus Status { get; private set; } = ScreeningStatus.Invited;
    public long CurrentRevision { get; private set; }
    public string PackageCode { get; internal set; } = string.Empty;
    public string JurisdictionCode { get; internal set; } = string.Empty;
    public ScreeningPayer Payer { get; internal set; }

    public string QuoteReference { get; internal set; } = string.Empty;
    public long LandlordAmountMinor { get; internal set; }
    public long ApplicantAmountMinor { get; internal set; }
    public long ProviderAmountMinor { get; internal set; }
    public long PlatformFeeMinor { get; internal set; }
    public long TaxAmountMinor { get; internal set; }
    public long TotalAmountMinor { get; internal set; }
    public string Currency { get; internal set; } = string.Empty;
    public DateTimeOffset QuoteExpiresAt { get; internal set; }
    public string QuotePolicyVersion { get; internal set; } = string.Empty;

    public string ProviderKey { get; internal set; } = string.Empty;
    public string? ProviderOrderId { get; internal set; }
    public long RequesterUserId { get; internal set; }
    public long RequesterMemberId { get; internal set; }
    public string RequesterMemberRole { get; internal set; } = string.Empty;
    public string RequesterPermissionSnapshot { get; internal set; } = string.Empty;
    public DateTimeOffset RequesterAuthorityVerifiedAt { get; internal set; }
    public string PermissiblePurposeStatement { get; internal set; } = string.Empty;
    public string PermissiblePurposeVersion { get; internal set; } = string.Empty;
    public string DisclosureStatement { get; internal set; } = string.Empty;
    public string DisclosureVersion { get; internal set; } = string.Empty;
    public string AuthorizationStatement { get; internal set; } = string.Empty;
    public string AuthorizationVersion { get; internal set; } = string.Empty;
    public string RentalCriteriaStatement { get; internal set; } = string.Empty;
    public string RentalCriteriaVersion { get; internal set; } = string.Empty;
    public string PricingPolicyVersion { get; internal set; } = string.Empty;
    public string AllowedChecksJson { get; internal set; } = "[]";
    public long? MaximumApplicantTotalMinor { get; internal set; }
    public bool ApplicantTotalExpresslyUnrestricted { get; internal set; }
    public long MaximumPlatformFeeMinor { get; internal set; }
    public bool MarkupPermitted { get; internal set; }
    public long MinimumQuoteLifetimeSeconds { get; internal set; }
    public long MaximumQuoteLifetimeSeconds { get; internal set; }

    public DateTimeOffset CreatedAt { get; internal set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public DateTimeOffset? ExpiredAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    internal void ApplyTransition(ScreeningStatus toStatus, long revision, DateTimeOffset occurredAt)
    {
        if (revision != checked(CurrentRevision + 1))
            throw new InvalidOperationException("Screening revision must be assigned sequentially by the server.");

        Status = toStatus;
        CurrentRevision = revision;
        UpdatedAt = occurredAt;
        if (toStatus == ScreeningStatus.Complete)
            CompletedAt = occurredAt;
        if (toStatus == ScreeningStatus.Expired)
            ExpiredAt = occurredAt;
    }

    internal void SetProviderOrder(string providerOrderId)
    {
        ScreeningContractValidation.ValidateBoundedText(providerOrderId, 200, nameof(providerOrderId), allowEmpty: false);
        if (ProviderOrderId is not null && !string.Equals(ProviderOrderId, providerOrderId, StringComparison.Ordinal))
            throw new InvalidOperationException("The provider order correlation cannot be changed.");
        ProviderOrderId = providerOrderId;
    }

    internal void SetApplicantAccess(string tokenHash, DateTimeOffset expiresAt)
    {
        ScreeningContractValidation.ValidateBoundedText(tokenHash, 64, nameof(tokenHash), false);
        if (tokenHash.Length != 64) throw new ArgumentException("Token hash must be SHA-256 hex.", nameof(tokenHash));
        ApplicantAccessTokenHash = tokenHash;
        ApplicantAccessExpiresAt = expiresAt;
    }

    internal void RevokeApplicantAccess()
    {
        ApplicantAccessTokenHash = null;
        ApplicantAccessExpiresAt = null;
    }

    public override string ToString() => $"TenantScreeningOrder {{ Id = [REDACTED], Status = {Status}, Revision = {CurrentRevision}, ProviderOrderId = [REDACTED], Access = [REDACTED], Quote = [REDACTED], Policy = [REDACTED] }}";
}

public sealed class ScreeningTransitionEvent
{
    public long Id { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public ScreeningStatus? FromStatus { get; internal set; }
    public ScreeningStatus ToStatus { get; internal set; }
    public long Revision { get; internal set; }
    public DateTimeOffset OccurredAt { get; internal set; }
    public DateTimeOffset RecordedAt { get; internal set; }
    public ScreeningTransitionSource Source { get; internal set; }
    public string? ReasonCode { get; internal set; }
    public string? ProviderEventId { get; internal set; }
    /// <summary>Provider namespace for ProviderEventId; provider event IDs are never globally unique.</summary>
    public string ProviderKey { get; internal set; } = string.Empty;
    public long? ActorUserId { get; internal set; }
}

public sealed class ScreeningConsentEvidence
{
    public long Id { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public string DisclosureVersion { get; internal set; } = string.Empty;
    public string AuthorizationVersion { get; internal set; } = string.Empty;
    public DateTimeOffset ConsentedAt { get; internal set; }
    public ScreeningConsentActorType ActorType { get; internal set; }
    public string IpAddressHash { get; internal set; } = string.Empty;
    public string UserAgentHash { get; internal set; } = string.Empty;
    public string QuoteReferenceHash { get; internal set; } = string.Empty;
    public string? ProviderAuthorizationReference { get; internal set; }
    public override string ToString() => $"ScreeningConsentEvidence {{ Id = [REDACTED], OrderId = [REDACTED], ConsentedAt = {ConsentedAt:O}, Versions = [REDACTED], NetworkEvidence = [REDACTED], Quote = [REDACTED] }}";
}

public sealed class ScreeningWebhookInboxEvent
{
    public long Id { get; internal set; }
    public string ProviderKey { get; internal set; } = string.Empty;
    public string ProviderEventId { get; internal set; } = string.Empty;
    public string PayloadSha256Hash { get; internal set; } = string.Empty;
    public DateTimeOffset ReceivedAt { get; internal set; }
    public DateTimeOffset OccurredAt { get; internal set; }
    public DateTimeOffset SignedAt { get; internal set; }
    public string AuthenticationScheme { get; internal set; } = string.Empty;
    public string AuthenticationKeyVersion { get; internal set; } = string.Empty;
    public long? ProviderSequence { get; internal set; }
    /// <summary>Verified normalized facts retained for replay. Raw callback payload is never retained.</summary>
    public string ProviderOrderId { get; internal set; } = string.Empty;
    public ScreeningStatus CanonicalStatus { get; internal set; }
    public string? NormalizedReasonCode { get; internal set; }
    public string? PaymentQuoteReferenceHash { get; internal set; }
    public string? PaymentOperationReferenceHash { get; internal set; }
    public ScreeningPayer? PaymentPayer { get; internal set; }
    public long? PaymentLandlordAmountMinor { get; internal set; }
    public long? PaymentApplicantAmountMinor { get; internal set; }
    public long? PaymentProviderAmountMinor { get; internal set; }
    public long? PaymentPlatformFeeMinor { get; internal set; }
    public long? PaymentTaxAmountMinor { get; internal set; }
    public long? PaymentTotalAmountMinor { get; internal set; }
    public string? PaymentCurrency { get; internal set; }
    public ScreeningPaymentEventStatus? PaymentStatus { get; internal set; }
    public DateTimeOffset? PaymentOccurredAt { get; internal set; }
    public string? PaymentFailureCode { get; internal set; }
    public DateTimeOffset? ProcessedAt { get; private set; }
    public Guid? ProcessingLeaseId { get; private set; }
    public DateTimeOffset? ProcessingLeaseUntil { get; private set; }
    public ScreeningInboxProcessingStatus ProcessingStatus { get; private set; } = ScreeningInboxProcessingStatus.Pending;
    public int ProcessingAttempts { get; private set; }
    public DateTimeOffset? NextAttemptAt { get; private set; }
    public string? FailureCode { get; private set; }
    public string? FailureDetail { get; private set; }
    public int DuplicateCount { get; private set; }
    public DateTimeOffset? LastDuplicateReceivedAt { get; private set; }
    public string? SecurityIncidentCode { get; private set; }
    public int SecurityIncidentCount { get; private set; }
    public DateTimeOffset? LastSecurityIncidentAt { get; private set; }
    public long? TenantScreeningOrderId { get; internal set; }
    public byte[] RowVersion { get; private set; } = [];

    internal void RecordDuplicate(DateTimeOffset receivedAt)
    {
        DuplicateCount = checked(DuplicateCount + 1);
        LastDuplicateReceivedAt = receivedAt;
    }

    internal void RecordSecurityIncident(string code, DateTimeOffset receivedAt)
    {
        ScreeningContractValidation.ValidateBoundedText(code, 100, nameof(code), allowEmpty: false);
        SecurityIncidentCode = code;
        SecurityIncidentCount = checked(SecurityIncidentCount + 1);
        LastSecurityIncidentAt = receivedAt;
    }

    internal bool TryAcquireLease(Guid leaseId, DateTimeOffset now, DateTimeOffset leaseUntil)
    {
        if (leaseId == Guid.Empty || leaseUntil <= now ||
            ProcessingStatus is ScreeningInboxProcessingStatus.Processed or ScreeningInboxProcessingStatus.DeadLettered or ScreeningInboxProcessingStatus.Stale ||
            (ProcessingStatus == ScreeningInboxProcessingStatus.RetryScheduled && NextAttemptAt.HasValue && NextAttemptAt > now) ||
            (ProcessingLeaseUntil.HasValue && ProcessingLeaseUntil > now))
            return false;

        ProcessingLeaseId = leaseId;
        ProcessingLeaseUntil = leaseUntil;
        ProcessingStatus = ScreeningInboxProcessingStatus.Processing;
        ProcessingAttempts = checked(ProcessingAttempts + 1);
        return true;
    }

    internal void MarkProcessed(DateTimeOffset now)
    {
        ProcessedAt = now;
        ProcessingStatus = ScreeningInboxProcessingStatus.Processed;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        NextAttemptAt = null;
        FailureCode = null;
        FailureDetail = null;
    }

    internal void MarkStale(string code, DateTimeOffset now)
    {
        ValidateFailure(code, null);
        ProcessedAt = now;
        ProcessingStatus = ScreeningInboxProcessingStatus.Stale;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        NextAttemptAt = null;
        FailureCode = code;
        FailureDetail = null;
    }

    public override string ToString() =>
        $"ScreeningWebhookInboxEvent {{ Id = [REDACTED], Status = {ProcessingStatus}, Provider = [REDACTED], Event = [REDACTED], AuthenticationScheme = {AuthenticationScheme}, AuthenticationKeyVersion = {AuthenticationKeyVersion}, SignedAt = {SignedAt:O}, Payload = [REDACTED] }}";

    internal void MarkFailure(string code, string? detail, DateTimeOffset now)
        => MarkDeadLettered(code, detail, now);

    internal void ScheduleRetry(string code, string? detail, DateTimeOffset now, DateTimeOffset nextAttemptAt, int maximumAttempts)
    {
        if (maximumAttempts <= 0) throw new ArgumentOutOfRangeException(nameof(maximumAttempts));
        ValidateFailure(code, detail);
        if (ProcessingAttempts >= maximumAttempts)
        {
            MarkDeadLettered(code, detail, now);
            return;
        }

        ProcessedAt = null;
        ProcessingStatus = ScreeningInboxProcessingStatus.RetryScheduled;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        NextAttemptAt = nextAttemptAt;
        FailureCode = code;
        FailureDetail = detail;
    }

    internal void MarkDeadLettered(string code, string? detail, DateTimeOffset now)
    {
        ValidateFailure(code, detail);
        ProcessedAt = now;
        ProcessingStatus = ScreeningInboxProcessingStatus.DeadLettered;
        ProcessingLeaseId = null;
        ProcessingLeaseUntil = null;
        NextAttemptAt = null;
        FailureCode = code;
        FailureDetail = detail;
    }

    private static void ValidateFailure(string code, string? detail)
    {
        ScreeningContractValidation.ValidateBoundedText(code, 100, nameof(code), allowEmpty: false);
        if (detail is not null)
            ScreeningContractValidation.ValidateBoundedText(detail, 500, nameof(detail), allowEmpty: true);
    }
}

public enum ScreeningReportAccessPurpose { RentalDecision = 1, AdverseActionReview = 2, DisputeReview = 3, SupportInvestigation = 4 }
public enum ScreeningReportAccessAttemptStatus { Requested = 1, Granted = 2, Failed = 3, Denied = 4 }

/// <summary>Append-only access attempt. It must never contain a URI, provider payload, or raw exception text.</summary>
public sealed class ScreeningReportAccessAudit
{
    public long Id { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    /// <summary>Authenticated staff actor; null only for an applicant capability-scoped access attempt.</summary>
    public long? ActorUserId { get; internal set; }
    public long ScreeningReportRevisionId { get; internal set; }
    public long AttemptSequence { get; internal set; }
    public ScreeningReportAccessPurpose Purpose { get; internal set; }
    public ScreeningReportAccessAttemptStatus Status { get; private set; } = ScreeningReportAccessAttemptStatus.Requested;
    public DateTimeOffset RequestedAt { get; internal set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public long? ScreeningSupportElevationId { get; internal set; }
    public DateTimeOffset? GrantExpiresAt { get; private set; }
    public string? GrantReference { get; private set; }
    public string? FailureCode { get; private set; }

    internal void MarkGranted(string reference, DateTimeOffset expiresAt, DateTimeOffset completedAt)
    {
        ScreeningContractValidation.ValidateBoundedText(reference, 200, nameof(reference), false);
        if (Status != ScreeningReportAccessAttemptStatus.Requested) throw new InvalidOperationException("Only requested report access may be granted.");
        Status = ScreeningReportAccessAttemptStatus.Granted; GrantReference = reference;
        GrantExpiresAt = expiresAt; CompletedAt = completedAt; FailureCode = null;
    }
    internal void MarkFailed(string code, DateTimeOffset completedAt)
    {
        ScreeningContractValidation.ValidateBoundedText(code, 100, nameof(code), false);
        if (Status != ScreeningReportAccessAttemptStatus.Requested) return;
        Status = ScreeningReportAccessAttemptStatus.Failed; FailureCode = code; CompletedAt = completedAt;
        GrantReference = null; GrantExpiresAt = null;
    }
    internal void MarkDenied(string code, DateTimeOffset completedAt)
    {
        ScreeningContractValidation.ValidateBoundedText(code, 100, nameof(code), false);
        if (Status != ScreeningReportAccessAttemptStatus.Requested) return;
        Status = ScreeningReportAccessAttemptStatus.Denied; FailureCode = code; CompletedAt = completedAt;
    }
    public override string ToString() => $"ScreeningReportAccessAudit {{ Id = [REDACTED], Status = {Status}, Purpose = {Purpose}, RequestedAt = {RequestedAt:O}, CompletedAt = {CompletedAt:O}, Correlation = [REDACTED], Grant = [REDACTED], Failure = [REDACTED] }}";
}

/// <summary>A server-issued, revocable support capability. HTTP report-access clients may reference only its ID.</summary>
public sealed class ScreeningSupportElevation
{
    public long Id { get; internal set; }
    public long OrganizationId { get; internal set; }
    public long SubjectUserId { get; internal set; }
    public long ApprovedByUserId { get; internal set; }
    public string CaseReference { get; internal set; } = string.Empty;
    public string Reason { get; internal set; } = string.Empty;
    public ScreeningReportAccessPurpose Purpose { get; internal set; }
    public DateTimeOffset IssuedAt { get; internal set; }
    public DateTimeOffset ExpiresAt { get; internal set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public long? RevokedByUserId { get; private set; }
    public int MaximumAccessCount { get; internal set; }
    public int AccessCount { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    internal bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now && AccessCount < MaximumAccessCount;
    internal void Consume()
    {
        if (AccessCount >= MaximumAccessCount) throw new InvalidOperationException("The support elevation is exhausted.");
        AccessCount = checked(AccessCount + 1);
    }
    internal void Revoke(long actorUserId, DateTimeOffset now)
    {
        if (RevokedAt.HasValue) return;
        RevokedAt = now; RevokedByUserId = actorUserId;
    }
    public override string ToString() => $"ScreeningSupportElevation {{ Id = [REDACTED], Purpose = {Purpose}, IssuedAt = {IssuedAt:O}, ExpiresAt = {ExpiresAt:O}, Revoked = {RevokedAt.HasValue}, Scope = [REDACTED] }}";
}

public sealed class ScreeningAdverseAction
{
    public long Id { get; internal set; }
    public long TenantScreeningOrderId { get; internal set; }
    public long OrganizationId { get; internal set; }
    public long RentalApplicationId { get; internal set; }
    public long DecisionActorUserId { get; internal set; }
    public long OriginalScreeningRentalDecisionRevisionId { get; internal set; }
    public long? OriginalScreeningReportRevisionId { get; internal set; }
    public ScreeningAdverseActionType ActionType { get; internal set; }
    public string ReasonCodesJson { get; internal set; } = "[]";
    public string RentalCriteriaVersion { get; internal set; } = string.Empty;
    public string CraContactName { get; internal set; } = string.Empty;
    public string CraContactAddress { get; internal set; } = string.Empty;
    public string CraContactPhone { get; internal set; } = string.Empty;
    public string NoticeVersion { get; internal set; } = string.Empty;
    /// <summary>Exact server-composed notice evidence used for delivery and replay.</summary>
    public string ImmutableNoticeContent { get; internal set; } = string.Empty;
    public string NoticeContentSha256Hash { get; internal set; } = string.Empty;
    public string StatutoryDisclosureVersion { get; internal set; } = string.Empty;
    public string StatutoryDisclosureSha256Hash { get; internal set; } = string.Empty;
    public string StateLocalDisclosureVersion { get; internal set; } = string.Empty;
    public string StateLocalDisclosureSha256Hash { get; internal set; } = string.Empty;
    public string JurisdictionCode { get; internal set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; internal set; }
    public string? ReconsiderationLinkReference { get; internal set; }
}

/// <summary>Durable bounded classification; raw payloads and sensitive narratives are forbidden.</summary>
public sealed class ScreeningIncident
{
    public long Id { get; internal set; }
    public long? TenantScreeningOrderId { get; internal set; }
    public long? OrganizationId { get; internal set; }
    public string? ProviderKey { get; internal set; }
    public string? ProviderEventId { get; internal set; }
    public ScreeningIncidentType IncidentType { get; internal set; }
    public ScreeningIncidentSeverity Severity { get; internal set; }
    public ScreeningIncidentStatus Status { get; internal set; }
    public DateTimeOffset DetectedAt { get; internal set; }
    public DateTimeOffset? ContainedAt { get; internal set; }
    public DateTimeOffset? ResolvedAt { get; internal set; }
    public long? ActorUserId { get; internal set; }
    public string AffectedResourceSha256Hash { get; internal set; } = string.Empty;
    public string DetectionSource { get; internal set; } = string.Empty;
    public string? FailureEvidenceReference { get; internal set; }
    public string? RemediationEvidenceReference { get; internal set; }
    public string? NotificationEvidenceReference { get; internal set; }
    public override string ToString() => $"ScreeningIncident {{ Id = [REDACTED], Type = {IncidentType}, Severity = {Severity}, Status = {Status}, Correlation = [REDACTED], Evidence = [REDACTED] }}";
}

/// <summary>Append-only incident status history.</summary>
public sealed class ScreeningIncidentEvent
{
    public long Id { get; internal set; }
    public long ScreeningIncidentId { get; internal set; }
    public long Revision { get; internal set; }
    public ScreeningIncidentStatus Status { get; internal set; }
    public DateTimeOffset OccurredAt { get; internal set; }
    public long? ActorUserId { get; internal set; }
    public string? EvidenceReference { get; internal set; }
    internal ScreeningIncident Incident { get; set; } = null!;
}
