using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Models;
using DocuSign.eSign.Api;
using DocuSign.eSign.Client;
using DocuSign.eSign.Model;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.ESignatureService
{
    /// <summary>
    /// DocuSign implementation of e-signature service
    /// </summary>
    public class DocuSignService : IESignatureService
    {
        private readonly DocuSignSettings _settings;
        private readonly ILogger<DocuSignService> _logger;
        private readonly IHttpClientFactory _httpClientFactory;

        public DocuSignService(
            IOptions<DocuSignSettings> settings,
            ILogger<DocuSignService> logger,
            IHttpClientFactory httpClientFactory)
        {
            _settings = settings.Value;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
        }

        /// <summary>
        /// Get authenticated DocuSign API client
        /// </summary>
        private async Task<ApiClient> GetAuthenticatedClientAsync(CancellationToken cancellationToken)
        {
            try
            {
                // Create ApiClient without base URL (will be set later)
                var apiClient = new ApiClient();

                // Read private key
                string privateKey;
                if (!string.IsNullOrEmpty(_settings.PrivateKeyContent))
                {
                    privateKey = _settings.PrivateKeyContent;
                }
                else if (!string.IsNullOrEmpty(_settings.PrivateKeyPath) && System.IO.File.Exists(_settings.PrivateKeyPath))
                {
                    privateKey = await System.IO.File.ReadAllTextAsync(_settings.PrivateKeyPath, cancellationToken);
                }
                else
                {
                    throw new InvalidOperationException("DocuSign private key not configured. Please set either PrivateKeyPath or PrivateKeyContent in appsettings.json");
                }

                // Request JWT token
                // Convert private key string to Stream
                using var privateKeyStream = new MemoryStream(Encoding.UTF8.GetBytes(privateKey));
                // The DocuSign SDK exposes only a synchronous authentication call.
                cancellationToken.ThrowIfCancellationRequested();
                var authToken = apiClient.RequestJWTUserToken(
                    _settings.IntegrationKey,
                    _settings.UserId,
                    _settings.AuthServer,
                    privateKeyStream,
                    _settings.JwtExpirationSeconds);
                cancellationToken.ThrowIfCancellationRequested();

                if (authToken == null || string.IsNullOrEmpty(authToken.access_token))
                {
                    throw new InvalidOperationException("Failed to obtain DocuSign authentication token");
                }

                // Set base path - use the ApiBaseUrl as-is (should include /restapi)
                // Example: https://demo.docusign.net/restapi or https://www.docusign.net/restapi
                apiClient.SetBasePath(_settings.ApiBaseUrl);

                // Use indexer to overwrite if key already exists (prevents "key already existed" error)
                apiClient.Configuration.DefaultHeader["Authorization"] = $"Bearer {authToken.access_token}";

                return apiClient;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception)
            {
                _logger.LogError("DocuSign authentication failed for account {AccountId}", _settings.AccountId);
                throw;
            }
        }

        public async Task<ServiceResponse<SignatureEnvelopeDto>> SendForSignature(
            SendLeaseForSignatureDto request,
            byte[] documentBytes,
            string documentName,
            CancellationToken cancellationToken)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync(cancellationToken);
                var envelopesApi = new EnvelopesApi(apiClient);

                // Keep all envelope construction, including expiration and signer tabs, in the
                // independently tested factory. Do not construct a second envelope here.
                var envelope = DocuSignEnvelopeFactory.Create(request, documentBytes, documentName);

                // Create envelope
                cancellationToken.ThrowIfCancellationRequested();
                var envelopeSummary = envelopesApi.CreateEnvelope(_settings.AccountId, envelope);
                cancellationToken.ThrowIfCancellationRequested();

                if (string.IsNullOrEmpty(envelopeSummary.EnvelopeId))
                {
                    return ServiceResponse<SignatureEnvelopeDto>.CreateError(
                        "Failed to create DocuSign envelope",
                        "Envelope ID was not returned from DocuSign");
                }

                // For embedded signing, we need to update the envelope status to "sent" 
                // (but it won't send emails because we're using ClientUserId for embedded signing)
                if (request.UseEmbeddedSigning && envelope.Status == "created")
                {
                    try
                    {
                        var envelopeUpdate = new Envelope
                        {
                            Status = "sent"
                        };
                        cancellationToken.ThrowIfCancellationRequested();
                        envelopesApi.Update(_settings.AccountId, envelopeSummary.EnvelopeId, envelopeUpdate);
                        cancellationToken.ThrowIfCancellationRequested();
                        _logger.LogInformation("Updated envelope {EnvelopeId} status to 'sent' for embedded signing", envelopeSummary.EnvelopeId);
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception)
                    {
                        _logger.LogWarning("DocuSign envelope status update failed for envelope {EnvelopeId}", envelopeSummary.EnvelopeId);
                    }
                }

                // Get signing URLs for each recipient (only for non-embedded signing)
                var signerUrls = new Dictionary<string, string>();
                if (!request.UseEmbeddedSigning)
                {
                    var recipientViewRequest = new RecipientViewRequest
                    {
                        AuthenticationMethod = "none",
                        ReturnUrl = $"{_settings.ApiBaseUrl}/signing-complete",
                        UserName = request.LandlordName,
                        Email = request.LandlordEmail
                    };

                    try
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        var viewUrl = envelopesApi.CreateRecipientView(_settings.AccountId, envelopeSummary.EnvelopeId, recipientViewRequest);
                        cancellationToken.ThrowIfCancellationRequested();
                        if (!string.IsNullOrEmpty(viewUrl?.Url))
                        {
                            signerUrls[request.LandlordEmail] = viewUrl.Url;
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception)
                    {
                        _logger.LogWarning("DocuSign recipient view creation failed for envelope {EnvelopeId}", envelopeSummary.EnvelopeId);
                    }
                }

                // Calculate expiration date
                var expiresAt = request.ExpirationDays > 0
                    ? DateTime.UtcNow.AddDays(request.ExpirationDays)
                    : (DateTime?)null;

                var result = new SignatureEnvelopeDto
                {
                    EnvelopeId = envelopeSummary.EnvelopeId,
                    SignerUrls = signerUrls,
                    ExpiresAt = expiresAt
                };

                _logger.LogInformation("Successfully created DocuSign envelope {EnvelopeId} for lease", envelopeSummary.EnvelopeId);

                return ServiceResponse<SignatureEnvelopeDto>.CreateSuccess(result, "Lease sent for signature successfully");
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception)
            {
                _logger.LogError("DocuSign send failed for lease {LeaseId}", request.LeaseId);
                return ServiceResponse<SignatureEnvelopeDto>.CreateError(
                    "External e-signature service unavailable",
                    "The e-signature provider could not complete the request.",
                    statusCode: 502);
            }
        }

        public async Task<ServiceResponse<SignatureStatusDto>> GetSignatureStatus(string envelopeId, CancellationToken cancellationToken)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync(cancellationToken);
                var envelopesApi = new EnvelopesApi(apiClient);

                cancellationToken.ThrowIfCancellationRequested();
                var envelope = envelopesApi.GetEnvelope(_settings.AccountId, envelopeId);
                cancellationToken.ThrowIfCancellationRequested();

                if (envelope == null)
                {
                    return ServiceResponse<SignatureStatusDto>.CreateError(
                        "Envelope not found",
                        $"No envelope found with ID {envelopeId}",
                        statusCode: 404);
                }

                var signerStatuses = new Dictionary<string, SignerStatusDto>();

                // Get recipient statuses
                cancellationToken.ThrowIfCancellationRequested();
                var recipients = envelopesApi.ListRecipients(_settings.AccountId, envelopeId);
                cancellationToken.ThrowIfCancellationRequested();
                if (recipients?.Signers != null)
                {
                    foreach (var signer in recipients.Signers)
                    {
                        signerStatuses[signer.Email] = new SignerStatusDto
                        {
                            Email = signer.Email,
                            Name = signer.Name,
                            Status = signer.Status?.ToLower() ?? "unknown",
                            SignedAt = !string.IsNullOrEmpty(signer.SignedDateTime) && DateTime.TryParse(signer.SignedDateTime, out var signedDate)
                                ? signedDate
                                : null,
                            SigningUrl = null // Would need to generate view URL separately
                        };
                    }
                }

                var result = AdaptSignatureStatus(envelope, signerStatuses);

                return ServiceResponse<SignatureStatusDto>.CreateSuccess(result);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception)
            {
                _logger.LogError("DocuSign status lookup failed for envelope {EnvelopeId}", envelopeId);
                return ServiceResponse<SignatureStatusDto>.CreateError(
                    "External e-signature service unavailable",
                    "The e-signature provider could not complete the request.",
                    statusCode: 502);
            }
        }

        private static SignatureStatusDto AdaptSignatureStatus(
            Envelope envelope,
            Dictionary<string, SignerStatusDto> signerStatuses)
        {
            var authoritativeEnvelopeId = ESignatureEnvelopeId.RequireCanonical(envelope.EnvelopeId);
            return new SignatureStatusDto
            {
                EnvelopeId = authoritativeEnvelopeId,
                Status = envelope.Status?.ToLowerInvariant() ?? "unknown",
                SignerStatuses = signerStatuses,
                CompletedAt = !string.IsNullOrEmpty(envelope.CompletedDateTime) &&
                    DateTime.TryParse(envelope.CompletedDateTime, out var completedDate)
                        ? completedDate
                        : null,
                ExpiresAt = !string.IsNullOrEmpty(envelope.ExpireDateTime) &&
                    DateTime.TryParse(envelope.ExpireDateTime, out var expireDate)
                        ? expireDate
                        : null
            };
        }

        public async Task<ServiceResponse<byte[]>> GetSignedDocument(string envelopeId, CancellationToken cancellationToken)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync(cancellationToken);
                var envelopesApi = new EnvelopesApi(apiClient);

                // Get the combined document (all pages with signatures)
                cancellationToken.ThrowIfCancellationRequested();
                var document = envelopesApi.GetDocument(_settings.AccountId, envelopeId, "combined");
                cancellationToken.ThrowIfCancellationRequested();

                if (document == null)
                {
                    return ServiceResponse<byte[]>.CreateError(
                        "Document not found",
                        $"No signed document found for envelope {envelopeId}",
                        statusCode: 404);
                }

                // Read the stream to bytes
                using var memoryStream = new MemoryStream();
                await document.CopyToAsync(memoryStream, cancellationToken);
                var documentBytes = memoryStream.ToArray();

                return ServiceResponse<byte[]>.CreateSuccess(documentBytes);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception)
            {
                _logger.LogError("DocuSign document download failed for envelope {EnvelopeId}", envelopeId);
                return ServiceResponse<byte[]>.CreateError(
                    "External e-signature service unavailable",
                    "The e-signature provider could not complete the request.",
                    statusCode: 502);
            }
        }

        public async Task<ServiceResponse<bool>> CancelSignature(string envelopeId, string? reason, CancellationToken cancellationToken)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync(cancellationToken);
                var envelopesApi = new EnvelopesApi(apiClient);

                var envelopeUpdate = new Envelope
                {
                    Status = "voided",
                    VoidedReason = reason ?? "Cancelled by landlord"
                };

                cancellationToken.ThrowIfCancellationRequested();
                envelopesApi.Update(_settings.AccountId, envelopeId, envelopeUpdate);
                cancellationToken.ThrowIfCancellationRequested();

                _logger.LogInformation("Successfully voided DocuSign envelope {EnvelopeId}", envelopeId);

                return ServiceResponse<bool>.CreateSuccess(true, "Signature request cancelled successfully");
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception)
            {
                _logger.LogError("DocuSign cancellation failed for envelope {EnvelopeId}", envelopeId);
                return ServiceResponse<bool>.CreateError(
                    "External e-signature service unavailable",
                    "The e-signature provider could not complete the request.",
                    statusCode: 502);
            }
        }

        public async Task<ServiceResponse<bool>> ResendSignatureRequest(string envelopeId, CancellationToken cancellationToken)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync(cancellationToken);
                var envelopesApi = new EnvelopesApi(apiClient);

                // Get current envelope to verify it exists
                cancellationToken.ThrowIfCancellationRequested();
                var envelope = envelopesApi.GetEnvelope(_settings.AccountId, envelopeId);
                cancellationToken.ThrowIfCancellationRequested();
                if (envelope == null)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Envelope not found",
                        $"No envelope found with ID {envelopeId}",
                        statusCode: 404);
                }

                // Get recipients to resend to
                cancellationToken.ThrowIfCancellationRequested();
                var recipients = envelopesApi.ListRecipients(_settings.AccountId, envelopeId);
                cancellationToken.ThrowIfCancellationRequested();
                if (recipients?.Signers == null || !recipients.Signers.Any())
                {
                    return ServiceResponse<bool>.CreateError(
                        "No recipients found",
                        "Cannot resend: envelope has no recipients",
                        statusCode: 400);
                }

                // Use DocuSign's notification API to trigger a resend
                // This updates the envelope notification settings to trigger email resends
                var notification = new DocuSign.eSign.Model.Notification
                {
                    Reminders = new Reminders
                    {
                        ReminderEnabled = "true",
                        ReminderDelay = "0", // Send immediately
                        ReminderFrequency = "1"
                    },
                    Expirations = envelope.ExpireEnabled == "true"
                        ? new Expirations
                        {
                            ExpireEnabled = "true",
                            ExpireAfter = envelope.ExpireAfter
                        }
                        : null
                };

                // Update envelope with notification settings to trigger resend
                var envelopeUpdate = new Envelope
                {
                    Notification = notification
                };

                cancellationToken.ThrowIfCancellationRequested();
                envelopesApi.Update(_settings.AccountId, envelopeId, envelopeUpdate);
                cancellationToken.ThrowIfCancellationRequested();

                // Additionally, use the UpdateRecipients method to trigger resend emails
                // This is the recommended way to resend in DocuSign
                var recipientsUpdate = new Recipients
                {
                    Signers = recipients.Signers.Select(s => new Signer
                    {
                        Email = s.Email,
                        Name = s.Name,
                        RecipientId = s.RecipientId,
                        RoutingOrder = s.RoutingOrder,
                        Status = s.Status
                    }).ToList()
                };

                // Use UpdateRecipients to trigger resend
                // Note: The ResendEnvelope option may not be available in all SDK versions
                // As an alternative, we can use the notification update which we already did above
                cancellationToken.ThrowIfCancellationRequested();
                envelopesApi.UpdateRecipients(_settings.AccountId, envelopeId, recipientsUpdate);
                cancellationToken.ThrowIfCancellationRequested();

                _logger.LogInformation("Successfully triggered resend for DocuSign envelope {EnvelopeId}", envelopeId);

                return ServiceResponse<bool>.CreateSuccess(true, "Signature request resent successfully to all recipients");
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception)
            {
                _logger.LogError("DocuSign resend failed for envelope {EnvelopeId}", envelopeId);
                return ServiceResponse<bool>.CreateError(
                    "External e-signature service unavailable",
                    "The e-signature provider could not complete the request.",
                    statusCode: 502);
            }
        }

        public async Task<ServiceResponse<string>> GetEmbeddedSigningUrl(string envelopeId, string recipientEmail, string recipientName, string returnUrl, CancellationToken cancellationToken)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync(cancellationToken);
                var envelopesApi = new EnvelopesApi(apiClient);

                // Check envelope status - it must be "sent" to get embedded signing URL
                cancellationToken.ThrowIfCancellationRequested();
                var envelope = envelopesApi.GetEnvelope(_settings.AccountId, envelopeId);
                cancellationToken.ThrowIfCancellationRequested();
                if (envelope?.Status?.ToLower() == "created")
                {
                    // Update envelope to "sent" status (required for embedded signing)
                    // This won't send emails because ClientUserId is set on the signer
                    try
                    {
                        var envelopeUpdate = new Envelope
                        {
                            Status = "sent"
                        };
                        cancellationToken.ThrowIfCancellationRequested();
                envelopesApi.Update(_settings.AccountId, envelopeId, envelopeUpdate);
                cancellationToken.ThrowIfCancellationRequested();
                        _logger.LogInformation("Updated envelope {EnvelopeId} status from 'created' to 'sent' for embedded signing", envelopeId);
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception)
                    {
                        _logger.LogWarning("DocuSign envelope status update failed for envelope {EnvelopeId}", envelopeId);
                    }
                }

                // Create recipient view request for embedded signing
                // IMPORTANT: ClientUserId must match the ClientUserId set when creating the signer
                var recipientViewRequest = new RecipientViewRequest
                {
                    AuthenticationMethod = "none", // No authentication required for embedded signing
                    Email = recipientEmail,
                    UserName = recipientName,
                    ReturnUrl = returnUrl,
                    ClientUserId = recipientEmail // Must match the ClientUserId used when creating the signer in the envelope
                };

                _logger.LogInformation("Requesting DocuSign embedded signing URL for envelope {EnvelopeId}", envelopeId);

                // Create the recipient view (embedded signing URL)
                cancellationToken.ThrowIfCancellationRequested();
                var viewUrl = envelopesApi.CreateRecipientView(_settings.AccountId, envelopeId, recipientViewRequest);
                cancellationToken.ThrowIfCancellationRequested();

                if (string.IsNullOrEmpty(viewUrl?.Url))
                {
                    return ServiceResponse<string>.CreateError(
                        "Failed to generate embedded signing URL",
                        "DocuSign did not return a signing URL");
                }

                _logger.LogInformation("Generated DocuSign embedded signing URL for envelope {EnvelopeId}", envelopeId);

                return ServiceResponse<string>.CreateSuccess(viewUrl.Url, "Embedded signing URL generated successfully");
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception)
            {
                _logger.LogError("DocuSign embedded signing URL creation failed for envelope {EnvelopeId}", envelopeId);
                return ServiceResponse<string>.CreateError(
                    "External e-signature service unavailable",
                    "The e-signature provider could not complete the request.",
                    statusCode: 502);
            }
        }
    }
}

