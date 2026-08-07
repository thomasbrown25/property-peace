using brownstone_hub_api.Domain.Screening;

namespace brownstone_hub_api.Services.Screening;

/// <summary>Signals that a required screening integration is intentionally unavailable; safe for HTTP 503 mapping.</summary>
public sealed class ScreeningUnavailableException : Exception
{
    public ScreeningUnavailableException() : base("Tenant screening is temporarily unavailable.") { }
    public ScreeningUnavailableException(Exception inner) : base("Tenant screening is temporarily unavailable.", inner) { }
    public override string ToString() => "ScreeningUnavailableException { Details = [REDACTED] }";
}

public sealed class UnavailableScreeningProviderGateway : IScreeningProviderGateway
{
    public Task<AuthoritativeScreeningQuote> GetAuthoritativeQuoteAsync(ScreeningQuoteRequest request, CancellationToken cancellationToken = default) => Fail<AuthoritativeScreeningQuote>();
    public Task<ApplicantHostedSessionResult> CreateApplicantHostedSessionAsync(CreateApplicantScreeningSessionRequest request, CancellationToken cancellationToken = default) => Fail<ApplicantHostedSessionResult>();
    public Task<NormalizedScreeningStatusUpdate> GetStatusAsync(ScreeningStatusRequest request, CancellationToken cancellationToken = default) => Fail<NormalizedScreeningStatusUpdate>();
    public Task<NormalizedScreeningReportRevision> GetReportRevisionAsync(ScreeningReportRequest request, CancellationToken cancellationToken = default) => Fail<NormalizedScreeningReportRevision>();
    public Task<ScreeningReportAccessResult> GetReportAccessAsync(ScreeningReportAccessRequest request, CancellationToken cancellationToken = default) => Fail<ScreeningReportAccessResult>();
    public Task<ScreeningProviderOperationResult> CancelOrExpireAsync(ScreeningCancellationRequest request, CancellationToken cancellationToken = default) => Fail<ScreeningProviderOperationResult>();
    public Task<ScreeningProviderOperationResult> OpenDisputeAsync(ScreeningProviderDisputeRequest request, CancellationToken cancellationToken = default) => Fail<ScreeningProviderOperationResult>();
    public Task<ScreeningProviderOperationResult> DeleteReportAsync(ScreeningReportDeletionRequest request, CancellationToken cancellationToken = default) => Fail<ScreeningProviderOperationResult>();
    private static Task<T> Fail<T>() => Task.FromException<T>(new ScreeningUnavailableException());
    public override string ToString() => "UnavailableScreeningProviderGateway { Configuration = [REDACTED] }";
}

public sealed class UnavailableScreeningCallbackVerifier : IScreeningCallbackVerifier
{
    public ValueTask<VerifiedScreeningCallbackEnvelope> VerifyAsync(string providerKey, ScreeningCallbackRequest request, CancellationToken cancellationToken = default) =>
        ValueTask.FromException<VerifiedScreeningCallbackEnvelope>(new ScreeningUnavailableException());
    public override string ToString() => "UnavailableScreeningCallbackVerifier { Configuration = [REDACTED] }";
}

public sealed class UnavailableScreeningPolicyResolver : IScreeningPolicyResolver
{
    public Task<ScreeningPolicySnapshot> ResolveAsync(ScreeningPolicyResolutionRequest request, CancellationToken cancellationToken = default) =>
        Task.FromException<ScreeningPolicySnapshot>(new ScreeningUnavailableException());
    public override string ToString() => "UnavailableScreeningPolicyResolver { Configuration = [REDACTED] }";
}

public sealed class UnavailableScreeningQuoteOptionsResolver : IScreeningQuoteOptionsResolver
{
    public Task<ScreeningQuoteOptionsResult> ResolveAsync(ScreeningQuoteOptionsResolutionRequest request,
        CancellationToken cancellationToken = default) =>
        Task.FromException<ScreeningQuoteOptionsResult>(new ScreeningUnavailableException());
    public override string ToString() => "UnavailableScreeningQuoteOptionsResolver { Configuration = [REDACTED] }";
}

public sealed class UnavailableScreeningApplicantInvitationDelivery : IScreeningApplicantInvitationDelivery
{
    public Task DeliverAsync(ScreeningApplicantInvitationDeliveryRequest request, CancellationToken cancellationToken = default) =>
        Task.FromException(new ScreeningUnavailableException());
    public override string ToString() => "UnavailableScreeningApplicantInvitationDelivery { Configuration = [REDACTED] }";
}

public sealed class UnavailableScreeningApplicantLinkFactory : IScreeningApplicantLinkFactory
{
    public Uri CreateApplicantAccessLink(string rawToken) => throw new ScreeningUnavailableException();
    public override string ToString() => "UnavailableScreeningApplicantLinkFactory { Configuration = [REDACTED] }";
}

public sealed class UnavailableAdverseActionPolicyResolver : IAdverseActionPolicyResolver
{
    public Task<AdverseActionPolicySnapshot> ResolveAsync(AdverseActionPolicyResolutionRequest request, CancellationToken cancellationToken = default) =>
        Task.FromException<AdverseActionPolicySnapshot>(new ScreeningUnavailableException());
    public override string ToString() => "UnavailableAdverseActionPolicyResolver { Configuration = [REDACTED] }";
}

public sealed class UnavailableScreeningNoticeDelivery : IScreeningNoticeDelivery
{
    public Task<ScreeningNoticeDeliveryOutcome> DeliverAsync(ScreeningNoticeDeliveryRequest request, CancellationToken cancellationToken = default) =>
        Task.FromException<ScreeningNoticeDeliveryOutcome>(new ScreeningUnavailableException());
    public override string ToString() => "UnavailableScreeningNoticeDelivery { Configuration = [REDACTED] }";
}
