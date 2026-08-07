using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Dtos.Screening;

public sealed class CreateScreeningInvitationDto
{
    [Range(1, long.MaxValue)] public long ApplicationId { get; init; }
    [Required, StringLength(100, MinimumLength = 1)] public string Package { get; init; } = string.Empty;
    [EnumDataType(typeof(ScreeningPayer))] public ScreeningPayer Payer { get; init; }
    public override string ToString() => $"CreateScreeningInvitationDto {{ ApplicationId = [REDACTED], Package = [REDACTED], Payer = {Payer} }}";
}

public sealed class ApplicantConsentDto
{
    [Required, StringLength(200, MinimumLength = 1)] public string ExpectedQuoteReference { get; init; } = string.Empty;
    public bool DisclosureAccepted { get; init; }
    public bool AuthorizationAccepted { get; init; }
    [Required, StringLength(100, MinimumLength = 1)] public string DisclosureVersion { get; init; } = string.Empty;
    [Required, StringLength(100, MinimumLength = 1)] public string AuthorizationVersion { get; init; } = string.Empty;
    public override string ToString() => "ApplicantConsentDto { Quote = [REDACTED], Consent = [REDACTED], Versions = [REDACTED] }";
}

public sealed class ScreeningReportAccessDto
{
    [EnumDataType(typeof(ScreeningReportAccessPurpose))] public ScreeningReportAccessPurpose Purpose { get; init; }
    [Range(1, long.MaxValue)] public long? ElevationId { get; init; }
    public override string ToString() => $"ScreeningReportAccessDto {{ Purpose = {Purpose}, ElevationId = [REDACTED] }}";
}

/// <summary>Browser-safe one-time navigation exchange. Provider references and credentials are never included.</summary>
public sealed record ScreeningContinuationExchangeDto
{
    public ScreeningContinuationExchangeDto(Uri continuationUrl, DateTimeOffset expiresAt)
    {
        ValidateNavigation(continuationUrl, expiresAt);
        ContinuationUrl = continuationUrl.AbsoluteUri;
        ExpiresAt = expiresAt;
    }
    public string ContinuationUrl { get; }
    public DateTimeOffset ExpiresAt { get; }
    public override string ToString() => $"ScreeningContinuationExchangeDto {{ ContinuationUrl = [REDACTED], ExpiresAt = {ExpiresAt:O} }}";
    internal static void ValidateNavigation(Uri url, DateTimeOffset expiresAt)
    {
        ArgumentNullException.ThrowIfNull(url);
        if (!url.IsAbsoluteUri || !string.Equals(url.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            !string.IsNullOrEmpty(url.UserInfo) || string.IsNullOrWhiteSpace(url.Host) ||
            !string.IsNullOrEmpty(url.Fragment) || url.Port != 443)
            throw new ArgumentException("A safe HTTPS navigation URL is required.", nameof(url));
        var now = DateTimeOffset.UtcNow;
        if (expiresAt <= now || expiresAt > now.AddMinutes(15))
            throw new ArgumentOutOfRangeException(nameof(expiresAt), "Navigation access must be short-lived.");
    }
}

/// <summary>Browser-safe report navigation exchange. Provider references and credentials are never included.</summary>
public sealed record ScreeningReportAccessExchangeDto
{
    public ScreeningReportAccessExchangeDto(Uri accessUrl, DateTimeOffset expiresAt)
    {
        ScreeningContinuationExchangeDto.ValidateNavigation(accessUrl, expiresAt);
        AccessUrl = accessUrl.AbsoluteUri;
        ExpiresAt = expiresAt;
    }
    public string AccessUrl { get; }
    public DateTimeOffset ExpiresAt { get; }
    public override string ToString() => $"ScreeningReportAccessExchangeDto {{ AccessUrl = [REDACTED], ExpiresAt = {ExpiresAt:O} }}";
}

public sealed class HumanScreeningDecisionDto
{
    [EnumDataType(typeof(ScreeningRentalDecision))] public ScreeningRentalDecision Decision { get; init; }
    [Required, StringLength(100, MinimumLength = 1)] public string CriteriaVersion { get; init; } = string.Empty;
    [Range(1, long.MaxValue)] public long? ReportRevisionId { get; init; }
    [Required, MinLength(1), MaxLength(20)] public List<string> ReasonCodes { get; init; } = [];
}

public sealed class ScreeningDisputeDto
{
    [Range(1, long.MaxValue)] public long ReportRevisionId { get; init; }
    [Required, MinLength(1), MaxLength(20)] public List<string> IssueCodes { get; init; } = [];
    [Required, StringLength(2000, MinimumLength = 1)] public string Narrative { get; init; } = string.Empty;
    public override string ToString() => "ScreeningDisputeDto { Report = [REDACTED], Issues = [REDACTED], Narrative = [REDACTED] }";
}

public sealed class ScreeningCancellationDto
{
    [Required, StringLength(100, MinimumLength = 1)] public string ReasonCode { get; init; } = string.Empty;
}

public sealed class CreateAdverseActionDto
{
    [Range(1, long.MaxValue)] public long DecisionRevisionId { get; init; }
    [EnumDataType(typeof(ScreeningAdverseActionType))] public ScreeningAdverseActionType ActionType { get; init; }
    [EnumDataType(typeof(ScreeningAdverseActionDeliveryChannel))] public ScreeningAdverseActionDeliveryChannel Channel { get; init; }
}
public sealed class RetryAdverseActionDto
{
    [EnumDataType(typeof(ScreeningAdverseActionDeliveryChannel))] public ScreeningAdverseActionDeliveryChannel Channel { get; init; }
}
public sealed class ReconsiderationDto
{
    [Required, StringLength(1000, MinimumLength = 1)] public string Reason { get; init; } = string.Empty;
}
public sealed class ResolveReconsiderationDto
{
    [Required, StringLength(1000, MinimumLength = 1)] public string Reason { get; init; } = string.Empty;
    [Range(1, long.MaxValue)] public long? NewDecisionRevisionId { get; init; }
}
