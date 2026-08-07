using System.Collections.ObjectModel;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;

[assembly: InternalsVisibleTo("property-peace-api.Tests")]

namespace brownstone_hub_api.Domain.Screening;

public enum ScreeningStatus
{
    Invited = 0,
    ConsentPending = 1,
    PaymentPending = 2,
    Processing = 3,
    Complete = 4,
    ActionRequired = 5,
    Expired = 6,
    Disputed = 7,
    Failed = 8
}

public enum ScreeningPayer
{
    Landlord = 1,
    Applicant = 2,
    Split = 3
}

public enum ScreeningPaymentEventStatus
{
    AuthorizationInitiated = 1,
    Authorized = 2,
    Charged = 3,
    Failed = 4,
    Refunded = 5,
    ReceiptIssued = 6,
    Reversed = 7
}

/// <summary>Provider-neutral payment-operation evidence. It must never contain payment credentials.</summary>
public sealed record ScreeningPaymentOperationEvidence
{
    public ScreeningPaymentOperationEvidence(string operationReference, ScreeningPaymentEventStatus status,
        DateTimeOffset occurredAt, string? failureCode, DateTimeOffset now)
    {
        ScreeningContractValidation.ValidateBoundedText(operationReference, 200, nameof(operationReference), false);
        if (!Enum.IsDefined(status)) throw new ArgumentOutOfRangeException(nameof(status));
        ScreeningContractValidation.ValidateNow(now, nameof(now));
        ScreeningContractValidation.ValidateCallbackTime(occurredAt, now, nameof(occurredAt));
        if (failureCode is not null)
            ScreeningContractValidation.ValidateBoundedText(failureCode, 100, nameof(failureCode), false);
        if ((status == ScreeningPaymentEventStatus.Failed) != (failureCode is not null))
            throw new ArgumentException("Only failed payment evidence has a bounded failure code.", nameof(failureCode));
        OperationReference = operationReference;
        Status = status;
        OccurredAt = occurredAt;
        FailureCode = failureCode;
    }
    public string OperationReference { get; }
    public ScreeningPaymentEventStatus Status { get; }
    public DateTimeOffset OccurredAt { get; }
    public string? FailureCode { get; }
    public override string ToString() => $"ScreeningPaymentOperationEvidence {{ Operation = [REDACTED], Status = {Status}, OccurredAt = {OccurredAt:O}, Failure = [REDACTED] }}";
}

/// <summary>
/// Provider-neutral authoritative payment facts. Raw quote and operation references are reduced to
/// one-way hashes at construction and are never retained by the contract.
/// </summary>
public sealed record ScreeningAuthoritativePaymentUpdate
{
    public ScreeningAuthoritativePaymentUpdate(string quoteReference, string operationReference, ScreeningPayer payer,
        long landlordAmountMinor, long applicantAmountMinor, long providerAmountMinor, long platformFeeMinor,
        long taxAmountMinor, long totalAmountMinor, string currency, ScreeningPaymentEventStatus status,
        DateTimeOffset occurredAt, string? failureCode, DateTimeOffset now)
    {
        ScreeningContractValidation.ValidateBoundedText(quoteReference, 200, nameof(quoteReference), false);
        ScreeningContractValidation.ValidateBoundedText(operationReference, 200, nameof(operationReference), false);
        if (!Enum.IsDefined(payer)) throw new ArgumentOutOfRangeException(nameof(payer));
        if (!Enum.IsDefined(status)) throw new ArgumentOutOfRangeException(nameof(status));
        foreach (var amount in new[] { landlordAmountMinor, applicantAmountMinor, providerAmountMinor,
                     platformFeeMinor, taxAmountMinor, totalAmountMinor })
            if (amount < 0) throw new ArgumentOutOfRangeException(nameof(totalAmountMinor), "Amounts cannot be negative.");
        if (checked(landlordAmountMinor + applicantAmountMinor) != totalAmountMinor ||
            checked(providerAmountMinor + platformFeeMinor + taxAmountMinor) != totalAmountMinor)
            throw new ArgumentException("Payment amount components must exactly equal the total.", nameof(totalAmountMinor));
        var payerMatches = payer switch
        {
            ScreeningPayer.Landlord => landlordAmountMinor > 0 && applicantAmountMinor == 0,
            ScreeningPayer.Applicant => applicantAmountMinor > 0 && landlordAmountMinor == 0,
            ScreeningPayer.Split => landlordAmountMinor > 0 && applicantAmountMinor > 0,
            _ => false
        };
        if (!payerMatches) throw new ArgumentException("Payment amounts must match the selected payer.", nameof(payer));
        if (currency is not { Length: 3 } || currency.Any(x => x is < 'A' or > 'Z'))
            throw new ArgumentException("Currency must be a three-letter uppercase code.", nameof(currency));
        ScreeningContractValidation.ValidateNow(now, nameof(now));
        ScreeningContractValidation.ValidateCallbackTime(occurredAt, now, nameof(occurredAt));
        if (failureCode is not null)
            ScreeningContractValidation.ValidateBoundedText(failureCode, 100, nameof(failureCode), false);
        if ((status == ScreeningPaymentEventStatus.Failed) != (failureCode is not null))
            throw new ArgumentException("Only failed payment evidence has a bounded failure code.", nameof(failureCode));

        QuoteReferenceHash = HashReference(quoteReference);
        PaymentOperationReferenceHash = HashReference(operationReference);
        Payer = payer;
        LandlordAmountMinor = landlordAmountMinor;
        ApplicantAmountMinor = applicantAmountMinor;
        ProviderAmountMinor = providerAmountMinor;
        PlatformFeeMinor = platformFeeMinor;
        TaxAmountMinor = taxAmountMinor;
        TotalAmountMinor = totalAmountMinor;
        Currency = currency;
        Status = status;
        OccurredAt = occurredAt;
        FailureCode = failureCode;
    }

    public string QuoteReferenceHash { get; }
    public string PaymentOperationReferenceHash { get; }
    public ScreeningPayer Payer { get; }
    public long LandlordAmountMinor { get; }
    public long ApplicantAmountMinor { get; }
    public long ProviderAmountMinor { get; }
    public long PlatformFeeMinor { get; }
    public long TaxAmountMinor { get; }
    public long TotalAmountMinor { get; }
    public string Currency { get; }
    public ScreeningPaymentEventStatus Status { get; }
    public DateTimeOffset OccurredAt { get; }
    public string? FailureCode { get; }

    internal static string HashReference(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    public override string ToString() =>
        $"ScreeningAuthoritativePaymentUpdate {{ References = [REDACTED], Payer = {Payer}, Amounts = [REDACTED], Currency = {Currency}, Status = {Status}, OccurredAt = {OccurredAt:O}, Failure = [REDACTED] }}";
}

public sealed record AuthoritativeScreeningQuote
{
    private AuthoritativeScreeningQuote(
        ScreeningQuoteRequest quoteRequest,
        string quoteReference,
        ScreeningPayer payer,
        long landlordAmountMinor,
        long applicantAmountMinor,
        long providerAmountMinor,
        long platformFeeMinor,
        long taxAmountMinor,
        string currency,
        DateTimeOffset expiresAt,
        string policyVersion,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(quoteRequest);
        ScreeningContractValidation.ValidateBoundedText(
            quoteReference, 200, nameof(quoteReference), allowEmpty: false);
        if (!Enum.IsDefined(payer))
        {
            throw new ArgumentOutOfRangeException(nameof(payer), "Payer must be a defined value.");
        }

        ValidateNonnegative(landlordAmountMinor, nameof(landlordAmountMinor));
        ValidateNonnegative(applicantAmountMinor, nameof(applicantAmountMinor));
        ValidateNonnegative(providerAmountMinor, nameof(providerAmountMinor));
        ValidateNonnegative(platformFeeMinor, nameof(platformFeeMinor));
        ValidateNonnegative(taxAmountMinor, nameof(taxAmountMinor));

        var partyTotal = checked(landlordAmountMinor + applicantAmountMinor);
        var componentTotal = checked(providerAmountMinor + platformFeeMinor + taxAmountMinor);
        if (partyTotal != componentTotal)
        {
            throw new ArgumentException("Party amounts must equal the quote component total.");
        }

        var payerIsConsistent = payer switch
        {
            ScreeningPayer.Landlord => landlordAmountMinor > 0 && applicantAmountMinor == 0,
            ScreeningPayer.Applicant => applicantAmountMinor > 0 && landlordAmountMinor == 0,
            ScreeningPayer.Split => landlordAmountMinor > 0 && applicantAmountMinor > 0,
            _ => false
        };
        if (!payerIsConsistent)
        {
            throw new ArgumentException("Exactly the selected payer must have a positive amount.", nameof(payer));
        }

        if (quoteRequest.Payer != payer)
        {
            throw new ArgumentException("The quote payer must match its request context.", nameof(payer));
        }

        if (currency is not { Length: 3 } || currency.Any(character => character is < 'A' or > 'Z'))
        {
            throw new ArgumentException("Currency must be a three-letter uppercase code.", nameof(currency));
        }

        if (expiresAt <= now)
        {
            throw new ArgumentOutOfRangeException(nameof(expiresAt), "Quote expiration must be in the future.");
        }

        if (string.IsNullOrWhiteSpace(policyVersion) ||
            policyVersion.Length > 100 ||
            policyVersion.Any(char.IsControl))
        {
            throw new ArgumentException(
                "Policy version must be nonblank, at most 100 characters, and contain no control characters.",
                nameof(policyVersion));
        }

        QuoteRequest = quoteRequest;
        QuoteReference = quoteReference;
        Payer = payer;
        LandlordAmountMinor = landlordAmountMinor;
        ApplicantAmountMinor = applicantAmountMinor;
        ProviderAmountMinor = providerAmountMinor;
        PlatformFeeMinor = platformFeeMinor;
        TaxAmountMinor = taxAmountMinor;
        TotalAmountMinor = partyTotal;
        Currency = currency;
        ExpiresAt = expiresAt;
        PolicyVersion = policyVersion;
    }

    internal static AuthoritativeScreeningQuote Create(
        ScreeningQuoteRequest quoteRequest,
        string quoteReference,
        ScreeningPayer payer,
        long landlordAmountMinor,
        long applicantAmountMinor,
        long providerAmountMinor,
        long platformFeeMinor,
        long taxAmountMinor,
        string currency,
        DateTimeOffset expiresAt,
        string policyVersion,
        DateTimeOffset now) =>
        new(
            quoteRequest,
            quoteReference,
            payer,
            landlordAmountMinor,
            applicantAmountMinor,
            providerAmountMinor,
            platformFeeMinor,
            taxAmountMinor,
            currency,
            expiresAt,
            policyVersion,
            now);

    public ScreeningQuoteRequest QuoteRequest { get; }
    public string QuoteReference { get; }
    public ScreeningPayer Payer { get; }
    public long LandlordAmountMinor { get; }
    public long ApplicantAmountMinor { get; }
    public long ProviderAmountMinor { get; }
    public long PlatformFeeMinor { get; }
    public long TaxAmountMinor { get; }
    public long TotalAmountMinor { get; }
    public string Currency { get; }
    public DateTimeOffset ExpiresAt { get; }
    public string PolicyVersion { get; }

    public bool IsExpired(DateTimeOffset now) => ExpiresAt <= now;

    public override string ToString() =>
        $"AuthoritativeScreeningQuote {{ QuoteRequest = [REDACTED], QuoteReference = [REDACTED], Payer = {Payer}, LandlordAmountMinor = {LandlordAmountMinor}, ApplicantAmountMinor = {ApplicantAmountMinor}, ProviderAmountMinor = {ProviderAmountMinor}, PlatformFeeMinor = {PlatformFeeMinor}, TaxAmountMinor = {TaxAmountMinor}, TotalAmountMinor = {TotalAmountMinor}, Currency = {Currency}, ExpiresAt = {ExpiresAt:O}, PolicyVersion = {PolicyVersion} }}";

    private static void ValidateNonnegative(long amount, string parameterName)
    {
        if (amount < 0)
        {
            throw new ArgumentOutOfRangeException(parameterName, "Amounts cannot be negative.");
        }
    }
}

public sealed record ScreeningQuoteRequest
{
    public ScreeningQuoteRequest(
        long organizationId,
        long applicationId,
        long propertyId,
        long applicantId,
        string packageCode,
        string jurisdictionCode,
        ScreeningPayer payer)
    {
        ValidatePositive(organizationId, nameof(organizationId));
        ValidatePositive(applicationId, nameof(applicationId));
        ValidatePositive(propertyId, nameof(propertyId));
        ValidatePositive(applicantId, nameof(applicantId));

        if (string.IsNullOrWhiteSpace(packageCode) || packageCode.Length > 100 || packageCode.Any(char.IsControl))
        {
            throw new ArgumentException(
                "Package code must be nonblank, at most 100 characters, and contain no control characters.",
                nameof(packageCode));
        }

        if (jurisdictionCode is not { Length: 2 } ||
            jurisdictionCode.Any(character => character is < 'A' or > 'Z'))
        {
            throw new ArgumentException(
                "Jurisdiction code must be a two-letter uppercase code.",
                nameof(jurisdictionCode));
        }

        if (!Enum.IsDefined(payer))
        {
            throw new ArgumentOutOfRangeException(nameof(payer), "Payer must be a defined value.");
        }

        OrganizationId = organizationId;
        ApplicationId = applicationId;
        PropertyId = propertyId;
        ApplicantId = applicantId;
        PackageCode = packageCode;
        JurisdictionCode = jurisdictionCode;
        Payer = payer;
    }

    public long OrganizationId { get; }
    public long ApplicationId { get; }
    public long PropertyId { get; }
    public long ApplicantId { get; }
    public string PackageCode { get; }
    public string JurisdictionCode { get; }
    public ScreeningPayer Payer { get; }

    public override string ToString() =>
        $"ScreeningQuoteRequest {{ OrganizationId = [REDACTED], ApplicationId = [REDACTED], PropertyId = [REDACTED], ApplicantId = [REDACTED], PackageCode = [REDACTED], JurisdictionCode = {JurisdictionCode}, Payer = {Payer} }}";

    private static void ValidatePositive(long value, string parameterName)
    {
        if (value <= 0)
        {
            throw new ArgumentOutOfRangeException(parameterName, "Identifier must be positive.");
        }
    }
}

public sealed record CreateApplicantScreeningSessionRequest
{
    public CreateApplicantScreeningSessionRequest(
        long screeningOrderId,
        ScreeningQuoteRequest quoteRequest,
        AuthoritativeScreeningQuote authoritativeQuote,
        DateTimeOffset now)
    {
        if (screeningOrderId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(screeningOrderId), "Screening order ID must be positive.");
        }

        ArgumentNullException.ThrowIfNull(quoteRequest);
        ArgumentNullException.ThrowIfNull(authoritativeQuote);
        ScreeningContractValidation.ValidateNow(now, nameof(now));

        if (!quoteRequest.Equals(authoritativeQuote.QuoteRequest))
        {
            throw new ArgumentException(
                "The authoritative quote context must exactly match the session request context.",
                nameof(authoritativeQuote));
        }

        if (authoritativeQuote.IsExpired(now))
        {
            throw new ArgumentOutOfRangeException(nameof(authoritativeQuote), "The authoritative quote has expired.");
        }

        ScreeningOrderId = screeningOrderId;
        QuoteRequest = quoteRequest;
        AuthoritativeQuote = authoritativeQuote;
    }

    public long ScreeningOrderId { get; }
    public ScreeningQuoteRequest QuoteRequest { get; }
    public AuthoritativeScreeningQuote AuthoritativeQuote { get; }

    public override string ToString() =>
        "CreateApplicantScreeningSessionRequest { ScreeningOrderId = [REDACTED], QuoteRequest = [REDACTED], AuthoritativeQuote = [REDACTED] }";
}

public sealed record ApplicantHostedSessionResult
{
    public ApplicantHostedSessionResult(
        string providerOrderId,
        Uri continuationUri,
        DateTimeOffset expiresAt,
        IEnumerable<Uri> trustedProviderOrigins,
        DateTimeOffset now,
        ScreeningPaymentOperationEvidence? paymentEvidence = null)
    {
        ScreeningContractValidation.ValidateBoundedText(
            providerOrderId, 200, nameof(providerOrderId), allowEmpty: false);
        ScreeningContractValidation.ValidateNow(now, nameof(now));
        ArgumentNullException.ThrowIfNull(trustedProviderOrigins);

        var trustedOrigins = trustedProviderOrigins
            .Select(origin => ValidateAndNormalizeTrustedOrigin(origin, nameof(trustedProviderOrigins)))
            .ToHashSet(StringComparer.Ordinal);
        if (trustedOrigins.Count == 0)
        {
            throw new ArgumentException("At least one trusted provider origin is required.", nameof(trustedProviderOrigins));
        }

        ValidateSafeHttpsUri(continuationUri, nameof(continuationUri));
        if (!trustedOrigins.Contains(NormalizeOrigin(continuationUri)))
        {
            throw new ArgumentException("The continuation URI origin is not trusted.", nameof(continuationUri));
        }

        if (expiresAt <= now)
        {
            throw new ArgumentOutOfRangeException(
                nameof(expiresAt),
                "Session expiration must be in the future.");
        }

        ProviderOrderId = providerOrderId;
        ContinuationUri = continuationUri;
        ExpiresAt = expiresAt;
        PaymentEvidence = paymentEvidence;
    }

    public string ProviderOrderId { get; }
    public Uri ContinuationUri { get; }
    public DateTimeOffset ExpiresAt { get; }
    public ScreeningPaymentOperationEvidence? PaymentEvidence { get; }

    public bool IsExpired(DateTimeOffset now) => ExpiresAt <= now;

    public override string ToString() =>
        $"ApplicantHostedSessionResult {{ ProviderOrderId = [REDACTED], ContinuationUri = [REDACTED], ExpiresAt = {ExpiresAt:O} }}";

    private static string ValidateAndNormalizeTrustedOrigin(Uri origin, string parameterName)
    {
        ValidateSafeHttpsUri(origin, parameterName);
        if (origin.AbsolutePath != "/" || !string.IsNullOrEmpty(origin.Query))
        {
            throw new ArgumentException("Trusted provider entries must contain only an origin.", parameterName);
        }

        return NormalizeOrigin(origin);
    }

    private static void ValidateSafeHttpsUri(Uri? uri, string parameterName)
    {
        if (uri is null ||
            !uri.IsAbsoluteUri ||
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrEmpty(uri.Host) ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            !string.IsNullOrEmpty(uri.Fragment) ||
            uri.Port != 443)
        {
            throw new ArgumentException(
                "URI must be absolute HTTPS on the default port with no user information or fragment.",
                parameterName);
        }
    }

    private static string NormalizeOrigin(Uri uri) =>
        uri.GetLeftPart(UriPartial.Authority).TrimEnd('/').ToLowerInvariant();
}

public sealed record ScreeningStatusRequest
{
    public ScreeningStatusRequest(
        long organizationId,
        long applicationId,
        long screeningOrderId,
        string providerOrderId)
    {
        ScreeningContractValidation.ValidatePositiveId(organizationId, nameof(organizationId));
        ScreeningContractValidation.ValidatePositiveId(applicationId, nameof(applicationId));
        ScreeningContractValidation.ValidatePositiveId(screeningOrderId, nameof(screeningOrderId));
        ScreeningContractValidation.ValidateBoundedText(
            providerOrderId, 200, nameof(providerOrderId), allowEmpty: false);

        OrganizationId = organizationId;
        ApplicationId = applicationId;
        ScreeningOrderId = screeningOrderId;
        ProviderOrderId = providerOrderId;
    }

    public long OrganizationId { get; }
    public long ApplicationId { get; }
    public long ScreeningOrderId { get; }
    public string ProviderOrderId { get; }

    public override string ToString() =>
        "ScreeningStatusRequest { OrganizationId = [REDACTED], ApplicationId = [REDACTED], ScreeningOrderId = [REDACTED], ProviderOrderId = [REDACTED] }";
}

public sealed record NormalizedScreeningStatusUpdate
{
    public NormalizedScreeningStatusUpdate(
        string providerOrderId,
        ScreeningStatus status,
        DateTimeOffset occurredAt,
        string? reasonCode,
        DateTimeOffset now,
        ScreeningAuthoritativePaymentUpdate? paymentEvidence = null,
        long? providerSequence = null)
    {
        ScreeningContractValidation.ValidateBoundedText(
            providerOrderId, 200, nameof(providerOrderId), allowEmpty: false);
        if (!Enum.IsDefined(status))
        {
            throw new ArgumentOutOfRangeException(nameof(status), "Status must be a defined value.");
        }

        ScreeningContractValidation.ValidateNow(now, nameof(now));
        ScreeningContractValidation.ValidateCallbackTime(occurredAt, now, nameof(occurredAt));
        if (reasonCode is not null)
        {
            ScreeningContractValidation.ValidateBoundedText(reasonCode, 200, nameof(reasonCode), allowEmpty: true);
        }
        if (providerSequence <= 0)
            throw new ArgumentOutOfRangeException(nameof(providerSequence), "Provider sequence must be positive when supplied.");

        ProviderOrderId = providerOrderId;
        Status = status;
        OccurredAt = occurredAt;
        ReasonCode = reasonCode;
        PaymentEvidence = paymentEvidence;
        ProviderSequence = providerSequence;
    }

    public string ProviderOrderId { get; }
    public ScreeningStatus Status { get; }
    public DateTimeOffset OccurredAt { get; }
    public string? ReasonCode { get; }
    public ScreeningAuthoritativePaymentUpdate? PaymentEvidence { get; }
    public long? ProviderSequence { get; }

    public override string ToString() =>
        $"NormalizedScreeningStatusUpdate {{ ProviderOrderId = [REDACTED], Status = {Status}, OccurredAt = {OccurredAt:O}, ReasonCode = [REDACTED] }}";
}

public sealed record VerifiedScreeningCallbackEnvelope
{
    private VerifiedScreeningCallbackEnvelope(string providerKey, string eventId, NormalizedScreeningStatusUpdate update,
        DateTimeOffset verifiedAt, DateTimeOffset signedAt, string authenticationScheme,
        string authenticationKeyVersion, string signedPayloadSha256Hash)
    {
        ProviderKey = providerKey;
        EventId = eventId;
        Update = update;
        VerifiedAt = verifiedAt;
        SignedAt = signedAt;
        AuthenticationScheme = authenticationScheme;
        AuthenticationKeyVersion = authenticationKeyVersion;
        SignedPayloadSha256Hash = signedPayloadSha256Hash;
    }

    internal static VerifiedScreeningCallbackEnvelope Create(string providerKey, string eventId,
        NormalizedScreeningStatusUpdate update, DateTimeOffset verifiedAt, DateTimeOffset signedAt,
        string authenticationScheme, string authenticationKeyVersion, string signedPayloadSha256Hash,
        DateTimeOffset now)
    {
        ScreeningContractValidation.ValidateBoundedText(providerKey, 100, nameof(providerKey), allowEmpty: false);
        ScreeningContractValidation.ValidateBoundedText(eventId, 200, nameof(eventId), allowEmpty: false);
        ArgumentNullException.ThrowIfNull(update);
        ScreeningContractValidation.ValidateNow(now, nameof(now));
        ScreeningContractValidation.ValidateCallbackTime(verifiedAt, now, nameof(verifiedAt));
        ScreeningContractValidation.ValidateCallbackTime(signedAt, now, nameof(signedAt));
        ScreeningContractValidation.ValidateCallbackTime(update.OccurredAt, now, nameof(update));
        ScreeningContractValidation.ValidateBoundedText(authenticationScheme, 50, nameof(authenticationScheme), false);
        ScreeningContractValidation.ValidateBoundedText(authenticationKeyVersion, 100, nameof(authenticationKeyVersion), false);
        if (signedPayloadSha256Hash is not { Length: 64 } || signedPayloadSha256Hash.Any(c =>
                c is not (>= '0' and <= '9') and not (>= 'a' and <= 'f')))
            throw new ArgumentException("Signed payload digest must be a lowercase SHA-256 hash.", nameof(signedPayloadSha256Hash));
        if (update.OccurredAt > verifiedAt)
            throw new ArgumentOutOfRangeException(nameof(update), "Update occurrence cannot be later than verification.");

        return new VerifiedScreeningCallbackEnvelope(providerKey, eventId, update, verifiedAt, signedAt,
            authenticationScheme, authenticationKeyVersion, signedPayloadSha256Hash);
    }

    public string ProviderKey { get; }
    public string EventId { get; }
    public NormalizedScreeningStatusUpdate Update { get; }
    public DateTimeOffset VerifiedAt { get; }
    public DateTimeOffset SignedAt { get; }
    public string AuthenticationScheme { get; }
    public string AuthenticationKeyVersion { get; }
    public string SignedPayloadSha256Hash { get; }

    public override string ToString() =>
        $"VerifiedScreeningCallbackEnvelope {{ ProviderKey = [REDACTED], EventId = [REDACTED], Update = [REDACTED], VerifiedAt = {VerifiedAt:O}, SignedAt = {SignedAt:O}, AuthenticationScheme = {AuthenticationScheme}, AuthenticationKeyVersion = {AuthenticationKeyVersion}, SignedPayload = [REDACTED] }}";
}

public sealed record ScreeningCallbackRequest
{
    public ScreeningCallbackRequest(
        ReadOnlyMemory<byte> payload,
        IEnumerable<KeyValuePair<string, IEnumerable<string>>> headers)
    {
        ArgumentNullException.ThrowIfNull(headers);

        var collected = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var header in headers)
        {
            ScreeningContractValidation.ValidateBoundedText(
                header.Key, 200, "headerName", allowEmpty: false);
            ArgumentNullException.ThrowIfNull(header.Value, "headerValues");

            if (!collected.TryGetValue(header.Key, out var values))
            {
                values = new List<string>();
                collected.Add(header.Key, values);
            }

            foreach (var value in header.Value)
            {
                if (value is null || value.IndexOfAny(new[] { '\r', '\n', '\0' }) >= 0)
                {
                    throw new ArgumentException("Header values cannot be null or contain CR, LF, or NUL.", "headers");
                }

                values.Add(value);
            }
        }

        var immutableHeaders = new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var header in collected)
        {
            immutableHeaders.Add(header.Key, new ReadOnlyCollection<string>(header.Value.ToArray()));
        }

        Payload = payload.ToArray();
        Headers = new ReadOnlyDictionary<string, IReadOnlyList<string>>(immutableHeaders);
    }

    public ReadOnlyMemory<byte> Payload { get; }
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Headers { get; }

    public override string ToString() => "ScreeningCallbackRequest { Payload = [REDACTED], Headers = [REDACTED] }";
}

internal static class ScreeningContractValidation
{
    internal static void ValidatePositiveId(long value, string parameterName)
    {
        if (value <= 0)
        {
            throw new ArgumentOutOfRangeException(parameterName, "Identifier must be positive.");
        }
    }

    internal static void ValidateBoundedText(
        string? value,
        int maximumLength,
        string parameterName,
        bool allowEmpty)
    {
        if (value is null ||
            (!allowEmpty && string.IsNullOrWhiteSpace(value)) ||
            value.Length > maximumLength ||
            value.Any(char.IsControl))
        {
            throw new ArgumentException(
                $"Value must be {(allowEmpty ? "at most" : "nonblank and at most")} {maximumLength} characters and contain no control characters.",
                parameterName);
        }
    }

    internal static void ValidateNow(DateTimeOffset now, string parameterName)
    {
        if (now == default)
        {
            throw new ArgumentOutOfRangeException(parameterName, "Current time cannot be the default value.");
        }
    }

    internal static void ValidateCallbackTime(DateTimeOffset value, DateTimeOffset now, string parameterName)
    {
        if (value == default || value > now.AddMinutes(5))
        {
            throw new ArgumentOutOfRangeException(
                parameterName,
                "Timestamp must be non-default and no more than five minutes in the future.");
        }
    }
}

public enum NormalizedScreeningReportStatus
{
    Received = 1,
    Complete = 2,
    Corrected = 3
}

public enum ScreeningReportRetentionSignal
{
    ProviderPolicy = 1,
    LegalRequirement = 2,
    OrganizationPolicy = 3
}

public sealed record ScreeningReportRequest
{
    public ScreeningReportRequest(long organizationId, long applicationId, long screeningOrderId, string providerOrderId)
    {
        ScreeningContractValidation.ValidatePositiveId(organizationId, nameof(organizationId));
        ScreeningContractValidation.ValidatePositiveId(applicationId, nameof(applicationId));
        ScreeningContractValidation.ValidatePositiveId(screeningOrderId, nameof(screeningOrderId));
        ScreeningContractValidation.ValidateBoundedText(providerOrderId, 200, nameof(providerOrderId), false);
        OrganizationId = organizationId;
        ApplicationId = applicationId;
        ScreeningOrderId = screeningOrderId;
        ProviderOrderId = providerOrderId;
    }

    public long OrganizationId { get; }
    public long ApplicationId { get; }
    public long ScreeningOrderId { get; }
    public string ProviderOrderId { get; }
    public override string ToString() =>
        "ScreeningReportRequest { OrganizationId = [REDACTED], ApplicationId = [REDACTED], ScreeningOrderId = [REDACTED], ProviderOrderId = [REDACTED] }";
}

/// <summary>
/// Provider-neutral, bounded report evidence. Provider URLs, documents, and arbitrary identity data
/// are deliberately absent; normalized facts are additionally constrained by the application allowlist.
/// </summary>
public sealed record NormalizedScreeningReportRevision
{
    public NormalizedScreeningReportRevision(string providerReportReference, string reportVersion,
        NormalizedScreeningReportStatus status, IReadOnlyDictionary<string, string> normalizedFacts,
        DateTimeOffset occurredAt, TimeSpan retentionPeriod, ScreeningReportRetentionSignal retentionSignal,
        long? supersedesScreeningReportRevisionId, DateTimeOffset now)
    {
        ScreeningContractValidation.ValidateBoundedText(providerReportReference, 200, nameof(providerReportReference), false);
        ScreeningContractValidation.ValidateBoundedText(reportVersion, 100, nameof(reportVersion), false);
        if (!Enum.IsDefined(status)) throw new ArgumentOutOfRangeException(nameof(status));
        if (!Enum.IsDefined(retentionSignal)) throw new ArgumentOutOfRangeException(nameof(retentionSignal));
        ArgumentNullException.ThrowIfNull(normalizedFacts);
        ScreeningContractValidation.ValidateNow(now, nameof(now));
        ScreeningContractValidation.ValidateCallbackTime(occurredAt, now, nameof(occurredAt));
        if (retentionPeriod < TimeSpan.FromDays(1) || retentionPeriod > TimeSpan.FromDays(3650))
            throw new ArgumentOutOfRangeException(nameof(retentionPeriod));
        if ((status == NormalizedScreeningReportStatus.Corrected) != supersedesScreeningReportRevisionId.HasValue)
            throw new ArgumentException("Corrected reports must identify the local revision they supersede.", nameof(supersedesScreeningReportRevisionId));
        if (supersedesScreeningReportRevisionId.HasValue && supersedesScreeningReportRevisionId.Value <= 0)
            throw new ArgumentOutOfRangeException(nameof(supersedesScreeningReportRevisionId));

        ProviderReportReference = providerReportReference;
        ReportVersion = reportVersion;
        Status = status;
        NormalizedFacts = new ReadOnlyDictionary<string, string>(new Dictionary<string, string>(normalizedFacts, StringComparer.Ordinal));
        OccurredAt = occurredAt;
        RetrievedAt = now;
        RetentionPeriod = retentionPeriod;
        RetentionSignal = retentionSignal;
        SupersedesScreeningReportRevisionId = supersedesScreeningReportRevisionId;
    }

    public string ProviderReportReference { get; }
    public string ReportVersion { get; }
    public NormalizedScreeningReportStatus Status { get; }
    public IReadOnlyDictionary<string, string> NormalizedFacts { get; }
    public DateTimeOffset OccurredAt { get; }
    public DateTimeOffset RetrievedAt { get; }
    public TimeSpan RetentionPeriod { get; }
    public ScreeningReportRetentionSignal RetentionSignal { get; }
    public long? SupersedesScreeningReportRevisionId { get; }
    public override string ToString() =>
        $"NormalizedScreeningReportRevision {{ ProviderReportReference = [REDACTED], ReportVersion = {ReportVersion}, Status = {Status}, NormalizedFacts = [REDACTED], OccurredAt = {OccurredAt:O}, RetentionSignal = {RetentionSignal} }}";
}

public interface IScreeningProviderGateway
{
    Task<AuthoritativeScreeningQuote> GetAuthoritativeQuoteAsync(
        ScreeningQuoteRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Must be idempotent using request.ScreeningOrderId as the provider correlation/idempotency key.
    /// Repeating a local order must return the same provider order and must not create a second screening.
    /// </summary>
    Task<ApplicantHostedSessionResult> CreateApplicantHostedSessionAsync(
        CreateApplicantScreeningSessionRequest request,
        CancellationToken cancellationToken = default);

    Task<NormalizedScreeningStatusUpdate> GetStatusAsync(
        ScreeningStatusRequest request,
        CancellationToken cancellationToken = default);

    Task<NormalizedScreeningReportRevision> GetReportRevisionAsync(
        ScreeningReportRequest request,
        CancellationToken cancellationToken = default) =>
        throw new NotSupportedException("Provider report revision retrieval is not configured.");

    /// <summary>
    /// Provider must make grant creation idempotent on request.ProviderIdempotencyKey. A replay
    /// returns the same logical grant and must not mint an additional independently active grant.
    /// </summary>
    Task<ScreeningReportAccessResult> GetReportAccessAsync(
        ScreeningReportAccessRequest request,
        CancellationToken cancellationToken = default) =>
        throw new NotSupportedException("Provider report access is not configured.");

    Task<ScreeningReportAccessGrantSnapshot> IntrospectReportAccessAsync(
        ScreeningReportAccessRecoveryRequest request,
        CancellationToken cancellationToken = default) =>
        throw new NotSupportedException("Provider report access introspection is not configured.");

    /// <summary>Provider implementation must be idempotent on request.ProviderIdempotencyKey.</summary>
    Task<ScreeningProviderOperationResult> RevokeReportAccessAsync(
        ScreeningReportAccessRecoveryRequest request,
        CancellationToken cancellationToken = default) =>
        throw new NotSupportedException("Provider report access revocation is not configured.");

    /// <summary>Provider implementation must be idempotent on request.ScreeningOrderId.</summary>
    Task<ScreeningProviderOperationResult> CancelOrExpireAsync(
        ScreeningCancellationRequest request,
        CancellationToken cancellationToken = default) =>
        throw new NotSupportedException("Provider cancellation is not configured.");

    /// <summary>Provider implementation must be idempotent on request.LocalDisputeId.</summary>
    Task<ScreeningProviderOperationResult> OpenDisputeAsync(
        ScreeningProviderDisputeRequest request,
        CancellationToken cancellationToken = default) =>
        throw new NotSupportedException("Provider disputes are not configured.");

    /// <summary>Provider implementation must be idempotent on request.ReportRevisionId.</summary>
    Task<ScreeningProviderOperationResult> DeleteReportAsync(
        ScreeningReportDeletionRequest request,
        CancellationToken cancellationToken = default) =>
        throw new NotSupportedException("Provider report deletion is not configured.");

    /// <summary>Returns provider truth for the same deterministic deletion operation without deleting.</summary>
    Task<ScreeningReportDeletionSnapshot> IntrospectReportDeletionAsync(
        ScreeningReportDeletionRequest request,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(new ScreeningReportDeletionSnapshot(ScreeningReportDeletionStatus.Unknown, "introspection-unsupported"));
}

public interface IScreeningCallbackVerifier
{
    ValueTask<VerifiedScreeningCallbackEnvelope> VerifyAsync(
        string providerKey,
        ScreeningCallbackRequest request,
        CancellationToken cancellationToken = default);
}
