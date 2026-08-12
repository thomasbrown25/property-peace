using System.Buffers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Services.ESignatureService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/docusign/connect")]
[AllowAnonymous]
public sealed class DocuSignConnectController(
    ILeaseRepository leaseRepository,
    IDocuSignConnectProcessor processor,
    IOptions<DocuSignSettings> docuSignSettings,
    ILogger<DocuSignConnectController> logger) : ControllerBase
{
    private const string SignatureHeader = "X-Docusign-Signature-1";
    private static readonly TimeSpan MaximumFutureClockSkew = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan MaximumEventAge = TimeSpan.FromDays(3650);
    private readonly DocuSignSettings settings = docuSignSettings.Value;

    [HttpPost]
    [IgnoreAntiforgeryToken]
    [RequestSizeLimit(DocuSignSettings.DefaultConnectBodyLimitBytes)]
    public async Task<IActionResult> HandleConnect(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (string.IsNullOrWhiteSpace(settings.ConnectSecret))
        {
            logger.LogError("DocuSign Connect is unavailable because webhook authentication is not configured");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, Generic("Service unavailable"));
        }

        var maximumBytes = settings.ConnectBodyLimitBytes is > 0 and <= DocuSignSettings.DefaultConnectBodyLimitBytes
            ? settings.ConnectBodyLimitBytes
            : DocuSignSettings.DefaultConnectBodyLimitBytes;
        if (Request.ContentLength > maximumBytes)
            return StatusCode(StatusCodes.Status413PayloadTooLarge, Generic("Invalid request"));

        byte[] body;
        try
        {
            body = await ReadBoundedBodyAsync(Request.Body, maximumBytes, cancellationToken);
        }
        catch (PayloadTooLargeException)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, Generic("Invalid request"));
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            logger.LogWarning("DocuSign Connect request body could not be read");
            return BadRequest(Generic("Invalid request"));
        }

        if (!VerifyHmac(body, Request.Headers[SignatureHeader].FirstOrDefault(), settings.ConnectSecret))
        {
            logger.LogWarning("DocuSign Connect authentication failed");
            return Unauthorized(Generic("Unauthorized"));
        }

        DocuSignConnectUpdate update;
        try
        {
            update = ParseUpdate(body);
        }
        catch (JsonException)
        {
            logger.LogWarning("DocuSign Connect payload was malformed");
            return BadRequest(Generic("Invalid request"));
        }
        catch (FormatException)
        {
            logger.LogWarning("DocuSign Connect payload was invalid");
            return BadRequest(Generic("Invalid request"));
        }

        try
        {
            var mapping = await leaseRepository.GetLeaseByDocuSignEnvelopeIdAsync(update.EnvelopeId, cancellationToken);
            if (mapping == null)
            {
                logger.LogWarning("DocuSign Connect envelope has no authorized lease mapping");
                return Ok();
            }

            var result = await processor.SynchronizeAsync(mapping, update, cancellationToken);
            logger.LogInformation(
                "DocuSign Connect applied for lease {LeaseId}, organization {OrganizationId}, status {Status}, changed {Changed}",
                mapping.LeaseId, mapping.OrganizationId, update.Status, result.Applied);
            return Ok();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (UnauthorizedAccessException)
        {
            logger.LogWarning("DocuSign Connect envelope mapping validation failed");
            return Unauthorized(Generic("Unauthorized"));
        }
        catch (Exception)
        {
            logger.LogError("DocuSign Connect database synchronization failed for status {Status}", update.Status);
            return StatusCode(StatusCodes.Status500InternalServerError, Generic("Unable to process request"));
        }
    }

    private static object Generic(string message) => new { message };

    private static bool VerifyHmac(ReadOnlySpan<byte> payload, string? signature, string secret)
    {
        if (string.IsNullOrWhiteSpace(signature))
            return false;
        try
        {
            var supplied = Convert.FromBase64String(signature.Trim());
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
            var expected = hmac.ComputeHash(payload.ToArray());
            Span<byte> normalizedSupplied = stackalloc byte[32];
            if (supplied.Length == normalizedSupplied.Length)
                supplied.CopyTo(normalizedSupplied);
            var matches = CryptographicOperations.FixedTimeEquals(normalizedSupplied, expected);
            return matches & supplied.Length == expected.Length;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static async Task<byte[]> ReadBoundedBodyAsync(Stream stream, int maximumBytes, CancellationToken cancellationToken)
    {
        var rented = ArrayPool<byte>.Shared.Rent(Math.Min(maximumBytes + 1, 81920));
        try
        {
            using var output = new MemoryStream(Math.Min(maximumBytes, 81920));
            while (true)
            {
                var read = await stream.ReadAsync(rented.AsMemory(0, rented.Length), cancellationToken);
                if (read == 0) break;
                if (output.Length + read > maximumBytes)
                    throw new PayloadTooLargeException();
                await output.WriteAsync(rented.AsMemory(0, read), cancellationToken);
            }
            if (output.Length == 0)
                throw new FormatException("Payload is empty.");
            return output.ToArray();
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(rented);
        }
    }

    private static DocuSignConnectUpdate ParseUpdate(byte[] body)
    {
        using var document = JsonDocument.Parse(body, new JsonDocumentOptions
        {
            AllowTrailingCommas = false,
            CommentHandling = JsonCommentHandling.Disallow,
            MaxDepth = 32
        });
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty("event", out var eventElement) || eventElement.ValueKind != JsonValueKind.String ||
            !root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object ||
            !data.TryGetProperty("envelopeId", out var envelopeElement) || envelopeElement.ValueKind != JsonValueKind.String)
            throw new FormatException("Required Connect fields are missing.");

        var eventName = eventElement.GetString();
        var envelopeId = envelopeElement.GetString();
        if (string.IsNullOrWhiteSpace(eventName) || !ESignatureEnvelopeId.IsCanonical(envelopeId))
            throw new FormatException("Required Connect fields are invalid.");

        var summary = data.TryGetProperty("envelopeSummary", out var summaryElement) && summaryElement.ValueKind == JsonValueKind.Object
            ? summaryElement
            : default;
        var providerStatus = summary.ValueKind == JsonValueKind.Object &&
                             summary.TryGetProperty("status", out var statusElement) && statusElement.ValueKind == JsonValueKind.String
            ? statusElement.GetString()
            : null;
        var status = MapStatus(providerStatus ?? eventName);

        var now = DateTime.UtcNow;
        DateTime? eventOccurredAt = null;
        // statusChangedDateTime describes the envelope transition itself. Older Connect
        // configurations may only provide generatedDateTime, the authenticated event time.
        if (summary.ValueKind == JsonValueKind.Object &&
            summary.TryGetProperty("statusChangedDateTime", out var changedElement))
            eventOccurredAt = ParseBoundedUtc(changedElement, "Event", now);
        else if (root.TryGetProperty("generatedDateTime", out var generatedElement))
            eventOccurredAt = ParseBoundedUtc(generatedElement, "Event", now);

        DateTime? completedAt = null;
        if (summary.ValueKind == JsonValueKind.Object &&
            summary.TryGetProperty("completedDateTime", out var completedElement))
            completedAt = ParseBoundedUtc(completedElement, "Completion", now);

        if (IsTerminal(status) && !eventOccurredAt.HasValue)
            throw new FormatException("Terminal events require an authoritative occurrence timestamp.");

        var recipients = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        JsonElement recipientContainer = default;
        if (summary.ValueKind == JsonValueKind.Object && summary.TryGetProperty("recipients", out var summaryRecipients))
            recipientContainer = summaryRecipients;
        else if (data.TryGetProperty("recipients", out var dataRecipients))
            recipientContainer = dataRecipients;
        if (recipientContainer.ValueKind == JsonValueKind.Object &&
            recipientContainer.TryGetProperty("signers", out var signers) && signers.ValueKind == JsonValueKind.Array)
        {
            foreach (var signer in signers.EnumerateArray())
            {
                if (signer.ValueKind != JsonValueKind.Object ||
                    !signer.TryGetProperty("email", out var emailElement) || emailElement.ValueKind != JsonValueKind.String ||
                    !signer.TryGetProperty("status", out var signerStatusElement) || signerStatusElement.ValueKind != JsonValueKind.String)
                    continue;
                var signerStatus = signerStatusElement.GetString();
                if (!string.Equals(signerStatus, "signed", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(signerStatus, "completed", StringComparison.OrdinalIgnoreCase))
                    continue;
                if (!signer.TryGetProperty("signedDateTime", out var signedElement))
                    throw new FormatException("Signer timestamp is invalid.");
                var signedAt = ParseBoundedUtc(signedElement, "Signer", now);
                if (!signedAt.HasValue)
                    throw new FormatException("Signer timestamp is invalid.");
                var email = emailElement.GetString();
                if (!string.IsNullOrWhiteSpace(email) && email.Length <= 320)
                    recipients[email] = signedAt.Value;
            }
        }

        return new DocuSignConnectUpdate(envelopeId, status, completedAt, recipients, eventOccurredAt);
    }

    private static DateTime? ParseBoundedUtc(JsonElement element, string fieldName, DateTime now)
    {
        var value = element.ValueKind == JsonValueKind.String ? element.GetString() : null;
        var hasExplicitOffset = value != null &&
            (value.EndsWith('Z') ||
             (value.Length >= 6 && (value[^6] == '+' || value[^6] == '-') && value[^3] == ':'));
        if (!hasExplicitOffset ||
            !DateTimeOffset.TryParse(value, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.RoundtripKind, out var parsed))
            throw new FormatException($"{fieldName} timestamp is invalid.");

        var utc = parsed.UtcDateTime;
        if (utc > now + MaximumFutureClockSkew || utc < now - MaximumEventAge)
            throw new FormatException($"{fieldName} timestamp is outside the accepted range.");
        return utc;
    }

    private static bool IsTerminal(ESignatureStatus status) => status is
        ESignatureStatus.Completed or ESignatureStatus.Declined or
        ESignatureStatus.Cancelled or ESignatureStatus.Expired;

    private static ESignatureStatus MapStatus(string status) => status.ToLowerInvariant() switch
    {
        "sent" or "envelope-sent" => ESignatureStatus.Sent,
        "delivered" or "envelope-delivered" => ESignatureStatus.InProgress,
        "signed" or "recipient-signed" => ESignatureStatus.PartiallySigned,
        "completed" or "envelope-completed" => ESignatureStatus.Completed,
        "declined" or "envelope-declined" or "recipient-declined" => ESignatureStatus.Declined,
        "voided" or "envelope-voided" => ESignatureStatus.Cancelled,
        "expired" or "envelope-expired" => ESignatureStatus.Expired,
        _ => throw new FormatException("Unsupported Connect status.")
    };

    private sealed class PayloadTooLargeException : Exception;
}
