using System.Collections.ObjectModel;
using brownstone_hub_api.Domain.Screening;

namespace brownstone_hub_api.Services.Screening;

/// <summary>Trusted internal command. Organization and requester IDs come only from authenticated context.</summary>
public sealed record CreateTenantScreeningInvitationCommand
{
    public CreateTenantScreeningInvitationCommand(long organizationId, long requesterUserId, long rentalApplicationId,
        string packageCode, ScreeningPayer payer, string idempotencyKey)
    {
        ScreeningContractValidation.ValidatePositiveId(organizationId, nameof(organizationId));
        ScreeningContractValidation.ValidatePositiveId(requesterUserId, nameof(requesterUserId));
        ScreeningContractValidation.ValidatePositiveId(rentalApplicationId, nameof(rentalApplicationId));
        ScreeningContractValidation.ValidateBoundedText(packageCode, 100, nameof(packageCode), false);
        ScreeningContractValidation.ValidateBoundedText(idempotencyKey, 200, nameof(idempotencyKey), false);
        if (!Enum.IsDefined(payer)) throw new ArgumentOutOfRangeException(nameof(payer));
        OrganizationId = organizationId;
        RequesterUserId = requesterUserId;
        RentalApplicationId = rentalApplicationId;
        PackageCode = packageCode;
        Payer = payer;
        IdempotencyKey = idempotencyKey;
    }
    public long OrganizationId { get; }
    public long RequesterUserId { get; }
    public long RentalApplicationId { get; }
    public string PackageCode { get; }
    public ScreeningPayer Payer { get; }
    internal string IdempotencyKey { get; }
    public override string ToString() => $"CreateTenantScreeningInvitationCommand {{ OrganizationId = [REDACTED], RequesterUserId = [REDACTED], RentalApplicationId = [REDACTED], PackageCode = [REDACTED], Payer = {Payer}, IdempotencyKey = [REDACTED] }}";
}

public sealed record ScreeningPolicyResolutionRequest(long OrganizationId, long RequesterUserId, long RentalApplicationId,
    long PropertyId, long? UnitId, string PackageCode, ScreeningPayer Payer, string JurisdictionCode)
{
    public override string ToString() => "ScreeningPolicyResolutionRequest { Context = [REDACTED] }";
}

/// <summary>Immutable, server-resolved commercial and compliance policy used as order evidence.</summary>
public sealed record ScreeningPolicySnapshot
{
    public ScreeningPolicySnapshot(string providerKey, string permissiblePurposeStatement, string permissiblePurposeVersion,
        string disclosureStatement, string disclosureVersion, string authorizationStatement, string authorizationVersion,
        string rentalCriteriaStatement, string rentalCriteriaVersion, string pricingPolicyVersion, string allowedPackageCode,
        IEnumerable<string> allowedChecks, long? maximumApplicantTotalMinor, bool applicantTotalExpresslyUnrestricted,
        long maximumPlatformFeeMinor, bool markupPermitted, TimeSpan minimumQuoteLifetime, TimeSpan maximumQuoteLifetime,
        TimeSpan? applicantAccessLifetime = null)
    {
        foreach (var (value, max, name) in new[]
        {
            (providerKey, 100, nameof(providerKey)), (permissiblePurposeStatement, 2000, nameof(permissiblePurposeStatement)),
            (permissiblePurposeVersion, 100, nameof(permissiblePurposeVersion)), (disclosureStatement, 4000, nameof(disclosureStatement)),
            (disclosureVersion, 100, nameof(disclosureVersion)), (authorizationStatement, 4000, nameof(authorizationStatement)),
            (authorizationVersion, 100, nameof(authorizationVersion)), (rentalCriteriaStatement, 4000, nameof(rentalCriteriaStatement)),
            (rentalCriteriaVersion, 100, nameof(rentalCriteriaVersion)), (pricingPolicyVersion, 100, nameof(pricingPolicyVersion)),
            (allowedPackageCode, 100, nameof(allowedPackageCode))
        }) ScreeningContractValidation.ValidateBoundedText(value, max, name, false);
        ArgumentNullException.ThrowIfNull(allowedChecks);
        var checks = allowedChecks.Select(x => { ScreeningContractValidation.ValidateBoundedText(x, 100, nameof(allowedChecks), false); return x; })
            .Distinct(StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToArray();
        if (checks.Length == 0) throw new ArgumentException("At least one screening check must be allowed.", nameof(allowedChecks));
        if (maximumApplicantTotalMinor is null && !applicantTotalExpresslyUnrestricted)
            throw new ArgumentException("A missing applicant cap must be expressly unrestricted.", nameof(maximumApplicantTotalMinor));
        if (maximumApplicantTotalMinor < 0) throw new ArgumentOutOfRangeException(nameof(maximumApplicantTotalMinor));
        if (maximumPlatformFeeMinor < 0) throw new ArgumentOutOfRangeException(nameof(maximumPlatformFeeMinor));
        if (minimumQuoteLifetime <= TimeSpan.Zero || maximumQuoteLifetime < minimumQuoteLifetime)
            throw new ArgumentOutOfRangeException(nameof(maximumQuoteLifetime), "Quote lifetime bounds are invalid.");
        var accessLifetime = applicantAccessLifetime ?? TimeSpan.FromDays(90);
        if (accessLifetime < TimeSpan.FromDays(30) || accessLifetime > TimeSpan.FromDays(365))
            throw new ArgumentOutOfRangeException(nameof(applicantAccessLifetime), "Applicant access lifetime must be between 30 and 365 days.");
        ProviderKey = providerKey; PermissiblePurposeStatement = permissiblePurposeStatement; PermissiblePurposeVersion = permissiblePurposeVersion;
        DisclosureStatement = disclosureStatement; DisclosureVersion = disclosureVersion; AuthorizationStatement = authorizationStatement;
        AuthorizationVersion = authorizationVersion; RentalCriteriaStatement = rentalCriteriaStatement; RentalCriteriaVersion = rentalCriteriaVersion;
        PricingPolicyVersion = pricingPolicyVersion; AllowedPackageCode = allowedPackageCode;
        AllowedChecks = new ReadOnlyCollection<string>(checks); MaximumApplicantTotalMinor = maximumApplicantTotalMinor;
        ApplicantTotalExpresslyUnrestricted = applicantTotalExpresslyUnrestricted; MaximumPlatformFeeMinor = maximumPlatformFeeMinor;
        MarkupPermitted = markupPermitted; MinimumQuoteLifetime = minimumQuoteLifetime; MaximumQuoteLifetime = maximumQuoteLifetime;
        ApplicantAccessLifetime = accessLifetime;
    }
    public string ProviderKey { get; }
    public string PermissiblePurposeStatement { get; }
    public string PermissiblePurposeVersion { get; }
    public string DisclosureStatement { get; }
    public string DisclosureVersion { get; }
    public string AuthorizationStatement { get; }
    public string AuthorizationVersion { get; }
    public string RentalCriteriaStatement { get; }
    public string RentalCriteriaVersion { get; }
    public string PricingPolicyVersion { get; }
    public string AllowedPackageCode { get; }
    public IReadOnlyList<string> AllowedChecks { get; }
    public long? MaximumApplicantTotalMinor { get; }
    public bool ApplicantTotalExpresslyUnrestricted { get; }
    public long MaximumPlatformFeeMinor { get; }
    public bool MarkupPermitted { get; }
    public TimeSpan MinimumQuoteLifetime { get; }
    public TimeSpan MaximumQuoteLifetime { get; }
    public TimeSpan ApplicantAccessLifetime { get; }
    public override string ToString() => "ScreeningPolicySnapshot { Policy = [REDACTED] }";
}

public interface IScreeningPolicyResolver
{
    Task<ScreeningPolicySnapshot> ResolveAsync(ScreeningPolicyResolutionRequest request, CancellationToken cancellationToken = default);
}

public sealed record ScreeningQuoteOptionsResolutionRequest(long OrganizationId, long RequesterUserId,
    long RentalApplicationId, long PropertyId, long? UnitId, string JurisdictionCode);
public sealed record ScreeningQuoteOption(string PackageCode, ScreeningPayer Payer);
public sealed record ScreeningQuoteOptionsResult
{
    public ScreeningQuoteOptionsResult(IEnumerable<ScreeningQuoteOption> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        Options = options.Select(x =>
        {
            ArgumentNullException.ThrowIfNull(x);
            ScreeningContractValidation.ValidateBoundedText(x.PackageCode, 100, nameof(options), false);
            if (!Enum.IsDefined(x.Payer)) throw new ArgumentOutOfRangeException(nameof(options));
            return x;
        }).Distinct().OrderBy(x => x.PackageCode, StringComparer.Ordinal).ThenBy(x => x.Payer).ToArray();
        if (Options.Count == 0) throw new ScreeningUnavailableException();
    }
    public IReadOnlyList<ScreeningQuoteOption> Options { get; }
    public override string ToString() => "ScreeningQuoteOptionsResult { Options = [REDACTED] }";
}
public interface IScreeningQuoteOptionsResolver
{
    Task<ScreeningQuoteOptionsResult> ResolveAsync(ScreeningQuoteOptionsResolutionRequest request,
        CancellationToken cancellationToken = default);
}

public sealed record StaffScreeningOrderResult(long OrderId, long RentalApplicationId, long PropertyId, ScreeningStatus Status,
    long Revision, string PackageCode, ScreeningPayer Payer, long LandlordAmountMinor, long ApplicantAmountMinor,
    long TotalAmountMinor, string Currency, DateTimeOffset QuoteExpiresAt, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public override string ToString() => $"StaffScreeningOrderResult {{ OrderId = [REDACTED], Status = {Status}, Revision = {Revision}, Payer = {Payer}, TotalAmountMinor = {TotalAmountMinor}, Currency = {Currency}, QuoteExpiresAt = {QuoteExpiresAt:O} }}";
}

public sealed record ScreeningApplicantInvitationDeliveryRequest
{
    internal ScreeningApplicantInvitationDeliveryRequest(long screeningOrderId, string email, string firstName, string lastName,
        string rawToken, Uri applicantAccessUri, DateTimeOffset expiresAt)
    {
        ScreeningOrderId = screeningOrderId; Email = email; FirstName = firstName; LastName = lastName;
        RawToken = rawToken; ApplicantAccessUri = applicantAccessUri; ExpiresAt = expiresAt;
    }
    public long ScreeningOrderId { get; }
    internal string Email { get; }
    internal string FirstName { get; }
    internal string LastName { get; }
    internal string RawToken { get; }
    internal Uri ApplicantAccessUri { get; }
    public DateTimeOffset ExpiresAt { get; }
    public override string ToString() => $"ScreeningApplicantInvitationDeliveryRequest {{ ScreeningOrderId = [REDACTED], Contact = [REDACTED], Token = [REDACTED], Link = [REDACTED], ExpiresAt = {ExpiresAt:O} }}";
}

public interface IScreeningApplicantInvitationDelivery
{
    Task DeliverAsync(ScreeningApplicantInvitationDeliveryRequest request, CancellationToken cancellationToken = default);
}
public interface IScreeningApplicantLinkFactory { Uri CreateApplicantAccessLink(string rawToken); }

public sealed record ApplicantScreeningInvitationResult(long OrderId, ScreeningStatus Status, string QuoteReference,
    ScreeningPayer Payer, string PackageCode, long LandlordAmountMinor, long ApplicantAmountMinor, long ProviderAmountMinor,
    long PlatformFeeMinor, long TaxAmountMinor, long TotalAmountMinor, string Currency, DateTimeOffset QuoteExpiresAt,
    string PermissiblePurposeStatement, string PermissiblePurposeVersion, string DisclosureStatement, string DisclosureVersion,
    string AuthorizationStatement, string AuthorizationVersion, string RentalCriteriaStatement, string RentalCriteriaVersion,
    string PricingPolicyVersion, IReadOnlyList<string> AllowedChecks)
{
    public override string ToString() => $"ApplicantScreeningInvitationResult {{ OrderId = [REDACTED], Status = {Status}, Quote = [REDACTED], Payer = {Payer}, TotalAmountMinor = {TotalAmountMinor}, Currency = {Currency}, QuoteExpiresAt = {QuoteExpiresAt:O}, Policy = [REDACTED] }}";
}

public sealed record ScreeningQuoteSummary(ScreeningPayer Payer, long LandlordAmountMinor, long ApplicantAmountMinor,
    long ProviderAmountMinor, long PlatformFeeMinor, long TaxAmountMinor, long TotalAmountMinor, string Currency,
    DateTimeOffset ExpiresAt);
public sealed record ScreeningNormalizedFact(string Label, string Value);
public sealed record StaffScreeningReportSummary(long ReportRevisionId, long Revision, ScreeningReportStatus Status,
    DateTimeOffset ReceivedAt, DateTimeOffset? CorrectedAt, IReadOnlyList<ScreeningNormalizedFact> Facts);
public sealed record StaffScreeningDisputeSummary(long DisputeId, ScreeningDisputeStatus Status, DateTimeOffset OpenedAt,
    DateTimeOffset? ResolvedAt, IReadOnlyList<string> IssueCodes);
public sealed record StaffScreeningDecisionSummary(long DecisionRevisionId, long Revision, ScreeningRentalDecision Decision,
    IReadOnlyList<string> ReasonCodes, DateTimeOffset CreatedAt);
public sealed record ScreeningReasonCodeOption(string Code, string Label);
public sealed record ScreeningDeliverySummary(ScreeningDeliveryAttemptStatus Status, int AttemptNumber,
    ScreeningAdverseActionDeliveryChannel Channel, DateTimeOffset AttemptedAt, DateTimeOffset? DeliveredAt);
public sealed record StaffScreeningAdverseActionSummary(long AdverseActionId, ScreeningAdverseActionType ActionType,
    DateTimeOffset CreatedAt, ScreeningDeliverySummary? LatestDelivery, ScreeningReconsiderationStatus ReconsiderationStatus);
public sealed record StaffScreeningDetailResult(long OrderId, long RentalApplicationId, long PropertyId, long? UnitId,
    long? ListingId, ScreeningStatus Status, long Revision, string PackageCode, ScreeningQuoteSummary Quote,
    string RentalCriteriaVersion, string RentalCriteriaStatement, IReadOnlyList<ScreeningReasonCodeOption> ReasonCodeOptions,
    DateTimeOffset? ApplicantAccessExpiresAt, bool ApplicantAccessRevoked,
    long? LatestReportRevisionId, string NextAction, IReadOnlyList<StaffScreeningReportSummary> Reports, IReadOnlyList<StaffScreeningDisputeSummary> Disputes,
    StaffScreeningDecisionSummary? Decision, StaffScreeningAdverseActionSummary? AdverseAction,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public override string ToString() => $"StaffScreeningDetailResult {{ OrderId = [REDACTED], Status = {Status}, Revision = {Revision}, Details = [REDACTED] }}";
}
public sealed record ApplicantScreeningStatusResult(ScreeningStatus Status, ScreeningQuoteSummary Quote, string NextAction,
    string HelpText, string ConsentState, string PaymentState, string ProviderProcessingState, string DisputeStatus,
    string CorrectionStatus, ApplicantAdverseActionNoticeSummary? AdverseAction, ScreeningReconsiderationStatus ReconsiderationStatus,
    string SupportPath, long? LatestReportRevision)
{
    public override string ToString() => $"ApplicantScreeningStatusResult {{ Status = {Status}, State = [REDACTED] }}";
}
public sealed record ApplicantAccessMutationResult(DateTimeOffset? AccessExpiresAt, string StatusMessage)
{
    public override string ToString() => $"ApplicantAccessMutationResult {{ AccessExpiresAt = {AccessExpiresAt:O}, Message = [REDACTED] }}";
}

public enum ScreeningConsentOutcome { Started, AlreadyStarted }
public sealed record ApplicantScreeningConsentResult(long OrderId, ScreeningStatus Status, ScreeningConsentOutcome Outcome,
    Uri? ContinuationUri, DateTimeOffset? ContinuationExpiresAt)
{
    public override string ToString() => $"ApplicantScreeningConsentResult {{ OrderId = [REDACTED], Status = {Status}, Outcome = {Outcome}, ContinuationUri = [REDACTED] }}";
}

public enum ScreeningCallbackOutcome { Applied, Duplicate, SameState, Rejected, Stale }
public sealed record ScreeningCallbackApplyResult(ScreeningCallbackOutcome Outcome, long? OrderId, long? Revision)
{
    public override string ToString() => $"ScreeningCallbackApplyResult {{ Outcome = {Outcome}, OrderId = [REDACTED], Revision = {Revision?.ToString() ?? "none"} }}";
}

public interface ITenantScreeningService
{
    Task<StaffScreeningOrderResult> CreateInvitationAsync(CreateTenantScreeningInvitationCommand command, CancellationToken cancellationToken = default);
    Task RetryInvitationDeliveryAsync(long organizationId, long requesterUserId, long orderId, CancellationToken cancellationToken = default);
    Task<ApplicantScreeningInvitationResult> GetApplicantInvitationAsync(string rawToken, CancellationToken cancellationToken = default);
    Task<ApplicantScreeningStatusResult> GetApplicantStatusAsync(string rawToken, CancellationToken cancellationToken = default);
    Task<ScreeningQuoteOptionsResult> GetQuoteOptionsAsync(long organizationId, long requesterUserId,
        long rentalApplicationId, CancellationToken cancellationToken = default);
    Task<ApplicantScreeningConsentResult> ConsentAndStartAsync(string rawToken, string expectedQuoteReference,
        string acceptedDisclosureVersion, string acceptedAuthorizationVersion, string ipAddress, string userAgent,
        CancellationToken cancellationToken = default);
    Task<StaffScreeningOrderResult?> GetStaffOrderAsync(long organizationId, long requesterUserId, long orderId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StaffScreeningOrderResult>> ListStaffOrdersByApplicationAsync(long organizationId, long requesterUserId, long rentalApplicationId, CancellationToken cancellationToken = default);
    Task<StaffScreeningDetailResult?> GetStaffDetailAsync(long organizationId, long requesterUserId, long orderId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StaffScreeningDetailResult>> ListStaffDetailsByApplicationAsync(long organizationId, long requesterUserId, long rentalApplicationId, CancellationToken cancellationToken = default);
    Task<ApplicantAccessMutationResult> RevokeApplicantAccessAsync(long organizationId, long requesterUserId, long orderId, CancellationToken cancellationToken = default);
    Task<ApplicantAccessMutationResult> RotateApplicantAccessAsync(long organizationId, long requesterUserId, long orderId, CancellationToken cancellationToken = default);
    Task<ScreeningCallbackApplyResult> ApplyVerifiedCallbackAsync(string providerKey, ScreeningCallbackRequest request, CancellationToken cancellationToken = default);
    Task<int> ProcessPendingWebhookInboxAsync(int batchSize, TimeSpan leaseDuration, CancellationToken cancellationToken = default);
    Task<ScreeningCallbackApplyResult> ReconcileOrderAsync(long organizationId, long requesterUserId, long orderId, CancellationToken cancellationToken = default);
}

public sealed record ScreeningWebhookProcessingOptions
{
    public ScreeningWebhookProcessingOptions(int maximumAttempts = 5, TimeSpan? retryDelay = null,
        IEnumerable<ScreeningPaymentEventStatus>? successfulPaymentStates = null, TimeSpan? maximumSignedAge = null)
    {
        if (maximumAttempts <= 0 || maximumAttempts > 100) throw new ArgumentOutOfRangeException(nameof(maximumAttempts));
        var delay = retryDelay ?? TimeSpan.FromMinutes(1);
        if (delay <= TimeSpan.Zero || delay > TimeSpan.FromDays(1)) throw new ArgumentOutOfRangeException(nameof(retryDelay));
        var configuredStates = (successfulPaymentStates ??
                [ScreeningPaymentEventStatus.Authorized, ScreeningPaymentEventStatus.Charged])
            .Distinct().ToHashSet();
        if (configuredStates.Count == 0 || configuredStates.Any(x =>
                x is not (ScreeningPaymentEventStatus.Authorized or ScreeningPaymentEventStatus.Charged)))
            throw new ArgumentOutOfRangeException(nameof(successfulPaymentStates),
                "Successful payment states may contain only Authorized or Charged.");
        var signedAge = maximumSignedAge ?? TimeSpan.FromMinutes(5);
        if (signedAge <= TimeSpan.Zero || signedAge > TimeSpan.FromDays(1))
            throw new ArgumentOutOfRangeException(nameof(maximumSignedAge));
        MaximumAttempts = maximumAttempts;
        RetryDelay = delay;
        SuccessfulPaymentStates = configuredStates;
        MaximumSignedAge = signedAge;
    }
    public int MaximumAttempts { get; }
    public TimeSpan RetryDelay { get; }
    public IReadOnlySet<ScreeningPaymentEventStatus> SuccessfulPaymentStates { get; }
    public TimeSpan MaximumSignedAge { get; }
}

public sealed class ScreeningAuthorizationException : Exception { public ScreeningAuthorizationException() : base("The authenticated staff member is not authorized for tenant screening.") { } }
public sealed class ScreeningResourceNotFoundException(string resource) : Exception($"The requested {resource} was not found.");
public sealed class ScreeningApplicationIneligibleException : Exception { public ScreeningApplicationIneligibleException() : base("The rental application is not eligible for screening.") { } }
public sealed class ScreeningIdempotencyConflictException : Exception { public ScreeningIdempotencyConflictException() : base("The idempotency key was already used for a different screening request.") { } }
public sealed class ScreeningPolicyViolationException(string reason) : Exception($"The screening quote does not comply with server policy: {reason}.");
public sealed class ScreeningInvalidInvitationException : Exception { public ScreeningInvalidInvitationException() : base("The applicant invitation is invalid.") { } }
public sealed class ScreeningInvitationExpiredException : Exception { public ScreeningInvitationExpiredException() : base("The screening quote has expired.") { } }
public sealed class ScreeningAccessExpiredException : Exception { public ScreeningAccessExpiredException() : base("The applicant screening access has expired or been revoked.") { } }
public sealed class ScreeningInvalidStateException(string message = "The screening operation is not valid in the current state.") : Exception(message);
public sealed class ScreeningConsentMismatchException : Exception { public ScreeningConsentMismatchException() : base("The accepted quote or policy version does not match the invitation.") { } }
public sealed class ScreeningPaymentEvidenceException : Exception { public ScreeningPaymentEvidenceException() : base("Durable, quote-bound payment responsibility evidence is required before screening may advance.") { } }
public sealed class ScreeningWebhookIntegrityException : Exception { public ScreeningWebhookIntegrityException() : base("A provider event ID was replayed with different payload content.") { } }
public sealed class ScreeningProviderCorrelationException : Exception { public ScreeningProviderCorrelationException() : base("The provider response did not exactly match the screening order correlation.") { } }
public sealed class ScreeningReportIngestionException : Exception
{
    public ScreeningReportIngestionException(Exception? inner = null) : base("Provider report evidence could not be ingested; the screening order remains recoverable.", inner) { }
    public override string ToString() => "ScreeningReportIngestionException { Detail = [REDACTED] }";
}
public sealed class ScreeningReportAccessDeniedException : Exception { public ScreeningReportAccessDeniedException() : base("Report access is not permitted by current screening policy.") { } }
public sealed class ScreeningReportAccessException : Exception
{
    public ScreeningReportAccessException(Exception? inner = null) : base("Report access could not be completed.", inner) { }
    public override string ToString() => "ScreeningReportAccessException { Message = Report access could not be completed., Detail = [REDACTED] }";
}
public sealed class ScreeningDeliveryException : Exception
{
    public ScreeningDeliveryException(long orderId, Exception inner) : base("Applicant invitation delivery failed. The order remains consent-pending and a secure token-rotating retry is available.", inner) => OrderId = orderId;
    public long OrderId { get; }
    public override string ToString() => $"ScreeningDeliveryException {{ OrderId = [REDACTED], Message = {Message}, InnerException = [REDACTED] }}";
}
