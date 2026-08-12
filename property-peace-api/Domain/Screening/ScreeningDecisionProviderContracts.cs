namespace brownstone_hub_api.Domain.Screening;

public sealed record ScreeningReportAccessRequest
{
    public ScreeningReportAccessRequest(long organizationId, long applicationId, long screeningOrderId,
        string providerOrderId, string purpose, string? providerIdempotencyKey = null)
    {
        ScreeningContractValidation.ValidatePositiveId(organizationId, nameof(organizationId));
        ScreeningContractValidation.ValidatePositiveId(applicationId, nameof(applicationId));
        ScreeningContractValidation.ValidatePositiveId(screeningOrderId, nameof(screeningOrderId));
        ScreeningContractValidation.ValidateBoundedText(providerOrderId, 200, nameof(providerOrderId), false);
        ScreeningContractValidation.ValidateBoundedText(purpose, 200, nameof(purpose), false);
        if (providerIdempotencyKey is not null)
            ScreeningContractValidation.ValidateBoundedText(providerIdempotencyKey, 64, nameof(providerIdempotencyKey), false);
        OrganizationId = organizationId; ApplicationId = applicationId; ScreeningOrderId = screeningOrderId;
        ProviderOrderId = providerOrderId; Purpose = purpose; ProviderIdempotencyKey = providerIdempotencyKey;
    }
    public long OrganizationId { get; }
    public long ApplicationId { get; }
    public long ScreeningOrderId { get; }
    public string ProviderOrderId { get; }
    public string Purpose { get; }
    public string? ProviderIdempotencyKey { get; }
    public override string ToString() => "ScreeningReportAccessRequest { Correlation = [REDACTED], Purpose = [REDACTED] }";
}

public enum ScreeningReportAccessGrantStatus { NotFound = 1, Active = 2, Expired = 3, Revoked = 4, Unknown = 5 }

/// <summary>URI-free provider-neutral correlation for bounded grant introspection and revocation.</summary>
public sealed record ScreeningReportAccessRecoveryRequest
{
    public ScreeningReportAccessRecoveryRequest(long organizationId, long applicationId, long screeningOrderId,
        string providerOrderId, string providerIdempotencyKey)
    {
        ScreeningContractValidation.ValidatePositiveId(organizationId, nameof(organizationId));
        ScreeningContractValidation.ValidatePositiveId(applicationId, nameof(applicationId));
        ScreeningContractValidation.ValidatePositiveId(screeningOrderId, nameof(screeningOrderId));
        ScreeningContractValidation.ValidateBoundedText(providerOrderId, 200, nameof(providerOrderId), false);
        ScreeningContractValidation.ValidateBoundedText(providerIdempotencyKey, 64, nameof(providerIdempotencyKey), false);
        OrganizationId = organizationId; ApplicationId = applicationId; ScreeningOrderId = screeningOrderId;
        ProviderOrderId = providerOrderId; ProviderIdempotencyKey = providerIdempotencyKey;
    }
    public long OrganizationId { get; }
    public long ApplicationId { get; }
    public long ScreeningOrderId { get; }
    public string ProviderOrderId { get; }
    public string ProviderIdempotencyKey { get; }
    public override string ToString() => "ScreeningReportAccessRecoveryRequest { Correlation = [REDACTED] }";
}

public sealed record ScreeningReportAccessGrantSnapshot(ScreeningReportAccessGrantStatus Status, DateTimeOffset? ExpiresAt)
{
    public override string ToString() => $"ScreeningReportAccessGrantSnapshot {{ Status = {Status}, ExpiresAt = {ExpiresAt:O}, Correlation = [REDACTED] }}";
}

public sealed record ScreeningReportAccessResult
{
    private ScreeningReportAccessResult(Uri accessUri, DateTimeOffset expiresAt, string grantReference)
    { AccessUri = accessUri; ExpiresAt = expiresAt; GrantReference = grantReference; }

    internal static ScreeningReportAccessResult Create(Uri accessUri, DateTimeOffset expiresAt, string grantReference,
        IEnumerable<Uri> trustedProviderOrigins, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(accessUri);
        ArgumentNullException.ThrowIfNull(trustedProviderOrigins);
        ScreeningContractValidation.ValidateBoundedText(grantReference, 200, nameof(grantReference), false);
        if (expiresAt <= now || expiresAt > now.AddMinutes(15))
            throw new ArgumentOutOfRangeException(nameof(expiresAt), "Report grants must be future-dated and no longer than fifteen minutes.");
        ValidateSafeHttps(accessUri, nameof(accessUri));
        var origins = trustedProviderOrigins.Select(x =>
        {
            ValidateSafeHttps(x, nameof(trustedProviderOrigins));
            if (x.AbsolutePath != "/" || !string.IsNullOrEmpty(x.Query)) throw new ArgumentException("Trusted entries must be origins.", nameof(trustedProviderOrigins));
            return Origin(x);
        }).ToHashSet(StringComparer.Ordinal);
        if (origins.Count == 0 || !origins.Contains(Origin(accessUri)))
            throw new ArgumentException("Report access URI origin is not trusted.", nameof(accessUri));
        return new ScreeningReportAccessResult(accessUri, expiresAt, grantReference);
    }
    public Uri AccessUri { get; }
    public DateTimeOffset ExpiresAt { get; }
    internal string GrantReference { get; }
    public override string ToString() => $"ScreeningReportAccessResult {{ AccessUri = [REDACTED], ExpiresAt = {ExpiresAt:O}, GrantReference = [REDACTED] }}";
    private static string Origin(Uri uri) => uri.GetLeftPart(UriPartial.Authority).TrimEnd('/').ToLowerInvariant();
    private static void ValidateSafeHttps(Uri uri, string name)
    {
        if (!uri.IsAbsoluteUri || !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrEmpty(uri.Host) || !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Fragment) || uri.Port != 443)
            throw new ArgumentException("URI must be absolute default-port HTTPS without credentials or fragment.", name);
    }
}

/// <summary>Providers must make cancellation idempotent using ScreeningOrderId.</summary>
public sealed record ScreeningCancellationRequest
{
    public ScreeningCancellationRequest(long organizationId, long applicationId, long screeningOrderId, string? providerOrderId, string reasonCode)
    {
        ScreeningContractValidation.ValidatePositiveId(organizationId, nameof(organizationId));
        ScreeningContractValidation.ValidatePositiveId(applicationId, nameof(applicationId));
        ScreeningContractValidation.ValidatePositiveId(screeningOrderId, nameof(screeningOrderId));
        if (providerOrderId is not null) ScreeningContractValidation.ValidateBoundedText(providerOrderId, 200, nameof(providerOrderId), false);
        ScreeningContractValidation.ValidateBoundedText(reasonCode, 100, nameof(reasonCode), false);
        OrganizationId = organizationId; ApplicationId = applicationId; ScreeningOrderId = screeningOrderId;
        ProviderOrderId = providerOrderId; ReasonCode = reasonCode;
    }
    public long OrganizationId { get; }
    public long ApplicationId { get; }
    public long ScreeningOrderId { get; }
    public string? ProviderOrderId { get; }
    public string ReasonCode { get; }
    public override string ToString() => "ScreeningCancellationRequest { Correlation = [REDACTED], Reason = [REDACTED] }";
}

/// <summary>Providers must make dispute creation idempotent using LocalDisputeId.</summary>
public sealed record ScreeningProviderDisputeRequest
{
    public ScreeningProviderDisputeRequest(Guid localDisputeId, long organizationId, long applicationId, long screeningOrderId,
        string providerOrderId, string providerReportReference, IReadOnlyList<string> issueCodes)
    {
        if (localDisputeId == Guid.Empty) throw new ArgumentOutOfRangeException(nameof(localDisputeId));
        ScreeningContractValidation.ValidatePositiveId(organizationId, nameof(organizationId));
        ScreeningContractValidation.ValidatePositiveId(applicationId, nameof(applicationId));
        ScreeningContractValidation.ValidatePositiveId(screeningOrderId, nameof(screeningOrderId));
        ScreeningContractValidation.ValidateBoundedText(providerOrderId, 200, nameof(providerOrderId), false);
        ScreeningContractValidation.ValidateBoundedText(providerReportReference, 200, nameof(providerReportReference), false);
        ArgumentNullException.ThrowIfNull(issueCodes);
        if (issueCodes.Count is < 1 or > 20) throw new ArgumentException("One to twenty issue codes are required.", nameof(issueCodes));
        foreach (var code in issueCodes) ScreeningContractValidation.ValidateBoundedText(code, 100, nameof(issueCodes), false);
        LocalDisputeId = localDisputeId; OrganizationId = organizationId; ApplicationId = applicationId;
        ScreeningOrderId = screeningOrderId; ProviderOrderId = providerOrderId; ProviderReportReference = providerReportReference;
        IssueCodes = Array.AsReadOnly(issueCodes.Distinct(StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToArray());
    }
    public Guid LocalDisputeId { get; }
    public long OrganizationId { get; }
    public long ApplicationId { get; }
    public long ScreeningOrderId { get; }
    public string ProviderOrderId { get; }
    public string ProviderReportReference { get; }
    public IReadOnlyList<string> IssueCodes { get; }
    public override string ToString() => "ScreeningProviderDisputeRequest { Correlation = [REDACTED], Issues = [REDACTED] }";
}

public sealed record ScreeningProviderOperationResult
{
    public ScreeningProviderOperationResult(string providerReference, string status)
    {
        ScreeningContractValidation.ValidateBoundedText(providerReference, 200, nameof(providerReference), false);
        ScreeningContractValidation.ValidateBoundedText(status, 100, nameof(status), false);
        ProviderReference = providerReference; Status = status;
    }
    public string ProviderReference { get; }
    public string Status { get; }
    public override string ToString() => $"ScreeningProviderOperationResult {{ ProviderReference = [REDACTED], Status = {Status} }}";
}

public enum ScreeningReportDeletionStatus { Unknown = 1, Present = 2, Deleted = 3, NotFound = 4 }

public sealed record ScreeningReportDeletionSnapshot
{
    public ScreeningReportDeletionSnapshot(ScreeningReportDeletionStatus status, string providerReference)
    {
        ScreeningContractValidation.ValidateBoundedText(providerReference, 200, nameof(providerReference), false);
        Status = status;
        ProviderReference = providerReference;
    }
    public ScreeningReportDeletionStatus Status { get; }
    public string ProviderReference { get; }
    public override string ToString() => $"ScreeningReportDeletionSnapshot {{ Status = {Status}, ProviderReference = [REDACTED] }}";
}

/// <summary>Provider deletion is idempotent on ProviderIdempotencyKey and fully tenant scoped.</summary>
public sealed record ScreeningReportDeletionRequest
{
    public ScreeningReportDeletionRequest(long organizationId, long applicationId, long screeningOrderId,
        long reportRevisionId, string providerOrderId, string providerReportReference)
    {
        ScreeningContractValidation.ValidatePositiveId(organizationId, nameof(organizationId));
        ScreeningContractValidation.ValidatePositiveId(applicationId, nameof(applicationId));
        ScreeningContractValidation.ValidatePositiveId(screeningOrderId, nameof(screeningOrderId));
        ScreeningContractValidation.ValidatePositiveId(reportRevisionId, nameof(reportRevisionId));
        ScreeningContractValidation.ValidateBoundedText(providerOrderId, 200, nameof(providerOrderId), false);
        ScreeningContractValidation.ValidateBoundedText(providerReportReference, 200, nameof(providerReportReference), false);
        OrganizationId = organizationId; ApplicationId = applicationId; ScreeningOrderId = screeningOrderId;
        ReportRevisionId = reportRevisionId; ProviderOrderId = providerOrderId; ProviderReportReference = providerReportReference;
    }
    public long OrganizationId { get; }
    public long ApplicationId { get; }
    public long ScreeningOrderId { get; }
    public long ReportRevisionId { get; }
    public string ProviderOrderId { get; }
    public string ProviderReportReference { get; }
    /// <summary>Provider-neutral deterministic key used unchanged by calls, introspection, and reconciliation.</summary>
    public string ProviderIdempotencyKey => CreateProviderIdempotencyKey(OrganizationId, ScreeningOrderId, ReportRevisionId);
    public static string CreateProviderIdempotencyKey(long organizationId, long screeningOrderId, long reportRevisionId)
    {
        var material = System.Text.Encoding.UTF8.GetBytes(
            $"property-peace-report-deletion-v1\n{organizationId}\n{screeningOrderId}\n{reportRevisionId}");
        return Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(material)).ToLowerInvariant();
    }
    public override string ToString() => "ScreeningReportDeletionRequest { Correlation = [REDACTED] }";
}
