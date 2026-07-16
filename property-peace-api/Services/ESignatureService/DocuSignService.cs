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
        private async Task<ApiClient> GetAuthenticatedClientAsync()
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
                    privateKey = await System.IO.File.ReadAllTextAsync(_settings.PrivateKeyPath);
                }
                else
                {
                    throw new InvalidOperationException("DocuSign private key not configured. Please set either PrivateKeyPath or PrivateKeyContent in appsettings.json");
                }

                // Request JWT token
                // Convert private key string to Stream
                using var privateKeyStream = new MemoryStream(Encoding.UTF8.GetBytes(privateKey));
                var authToken = apiClient.RequestJWTUserToken(
                    _settings.IntegrationKey,
                    _settings.UserId,
                    _settings.AuthServer,
                    privateKeyStream,
                    _settings.JwtExpirationSeconds);

                if (authToken == null || string.IsNullOrEmpty(authToken.access_token))
                {
                    throw new InvalidOperationException("Failed to obtain DocuSign authentication token");
                }

                // Set base path - use the ApiBaseUrl as-is (should include /restapi)
                // Example: https://demo.docusign.net/restapi or https://www.docusign.net/restapi
                apiClient.SetBasePath(_settings.ApiBaseUrl);

                // Use indexer to overwrite if key already exists (prevents "key already existed" error)
                apiClient.Configuration.DefaultHeader["Authorization"] = $"Bearer {authToken.access_token}";

                _logger.LogInformation("DocuSign API client initialized with base path: {BasePath}", _settings.ApiBaseUrl);

                return apiClient;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error authenticating with DocuSign. ApiBaseUrl: {ApiBaseUrl}, AuthServer: {AuthServer}",
                    _settings.ApiBaseUrl, _settings.AuthServer);
                throw;
            }
        }

        public async Task<ServiceResponse<SignatureEnvelopeDto>> SendForSignature(
            SendLeaseForSignatureDto request,
            byte[] documentBytes,
            string documentName)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync();
                var envelopesApi = new EnvelopesApi(apiClient);

                // Create envelope definition
                var envelope = new EnvelopeDefinition
                {
                    EmailSubject = request.EmailSubject ?? "Please sign this lease agreement",
                    EmailBlurb = request.EmailMessage ?? "Please review and sign the attached lease agreement.",
                    Status = request.UseEmbeddedSigning ? "created" : "sent", // "created" for embedded signing, "sent" for email
                    EnforceSignerVisibility = "false", // Set to false so all signers can see all signatures
                    Documents = new List<Document>
                    {
                        new Document
                        {
                            DocumentBase64 = Convert.ToBase64String(documentBytes),
                            Name = documentName,
                            FileExtension = Path.GetExtension(documentName).TrimStart('.'),
                            DocumentId = "1"
                        }
                    }
                };

                // Create signers
                var signers = new List<Signer>();

                // Add landlord signer (first)
                // Use anchor text positioning so signatures adjust based on document length
                // Anchor strings should match text in the document (e.g., "LANDLORD" for signature, "LandlordDate" for date)
                var landlordSigner = new Signer
                {
                    Email = request.LandlordEmail,
                    Name = request.LandlordName,
                    RecipientId = "1",
                    RoutingOrder = "1",
                    Tabs = new Tabs
                    {
                        SignHereTabs = new List<SignHere>
                        {
                            new SignHere
                            {
                                DocumentId = "1",
                                AnchorString = "LANDLORD:", // Anchor to "LANDLORD:" text in document (matches document generation)
                                AnchorXOffset = "150", // Offset 100 pixels to the right from anchor
                                //AnchorYOffset = "20", // Offset 20 pixels down from anchor
                                AnchorUnits = "pixels", // Use pixels for offset
                                TabLabel = "LandlordSignature"
                            }
                        },
                        DateSignedTabs = new List<DateSigned>
                        {
                            new DateSigned
                            {
                                DocumentId = "1",
                                AnchorString = "LANDLORD:", // Anchor to "LANDLORD:" text in document (matches document generation)
                                AnchorXOffset = "335", // Offset 300 pixels to the right from anchor
                                //AnchorYOffset = "20", // Offset 20 pixels down from anchor (same line)
                                AnchorUnits = "pixels", // Use pixels for offset
                                TabLabel = "LandlordDate"
                            }
                        }
                    }
                };

                // For embedded signing, set ClientUserId (required for embedded signing)
                if (request.UseEmbeddedSigning)
                {
                    landlordSigner.ClientUserId = request.LandlordEmail; // Use email as client user ID
                }

                // Ensure landlord signature is visible to all recipients
                landlordSigner.RequireIdLookup = "false";
                landlordSigner.RoutingOrder = "1";

                signers.Add(landlordSigner);

                // Add tenant signers
                // Use anchor text positioning - anchor to "TENANT(S)" text, with increasing Y offset for each tenant
                int signerIndex = 2;
                foreach (var tenantSigner in request.TenantSigners.OrderBy(t => t.SigningOrder))
                {
                    // Calculate Y offset: first tenant at 20px, each subsequent tenant 50px further down
                    var yOffset = (20 + ((signerIndex - 2) * 50)).ToString(); // 20px for first, +50px for each additional

                    var tenantSignerObj = new Signer
                    {
                        Email = tenantSigner.Email,
                        Name = tenantSigner.Name,
                        RecipientId = signerIndex.ToString(),
                        RoutingOrder = tenantSigner.SigningOrder.ToString(),
                        RequireIdLookup = "false", // Ensure tenant can see all signatures
                        Tabs = new Tabs
                        {
                            SignHereTabs = new List<SignHere>
                            {
                                new SignHere
                                {
                                    DocumentId = "1",
                                    AnchorString = "TENANT(S):", // Anchor to "TENANT(S):" text in document (matches document generation)
                                    AnchorXOffset = "150", // Offset 100 pixels to the right from anchor
                                    //AnchorYOffset = yOffset, // Offset down based on tenant order
                                    AnchorUnits = "pixels", // Use pixels for offset
                                    TabLabel = $"TenantSignature{signerIndex - 1}"
                                }
                            },
                            DateSignedTabs = new List<DateSigned>
                            {
                                new DateSigned
                                {
                                    DocumentId = "1",
                                    AnchorString = "TENANT(S):", // Anchor to "TENANT(S):" text in document (matches document generation)
                                    AnchorXOffset = "355", // Offset 300 pixels to the right from anchor
                                    //AnchorYOffset = yOffset, // Same Y offset as signature (same line)
                                    AnchorUnits = "pixels", // Use pixels for offset
                                    TabLabel = $"TenantDate{signerIndex - 1}"
                                }
                            }
                        }
                    };
                    signers.Add(tenantSignerObj);
                    signerIndex++;
                }

                envelope.Recipients = new Recipients { Signers = signers };

                // Set expiration if specified
                if (request.ExpirationDays > 0)
                {
                    envelope.ExpireEnabled = "true";
                    envelope.ExpireAfter = request.ExpirationDays.ToString();
                }

                // Create envelope
                var envelopeSummary = envelopesApi.CreateEnvelope(_settings.AccountId, envelope);

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
                        envelopesApi.Update(_settings.AccountId, envelopeSummary.EnvelopeId, envelopeUpdate);
                        _logger.LogInformation("Updated envelope {EnvelopeId} status to 'sent' for embedded signing", envelopeSummary.EnvelopeId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not update envelope status to 'sent' for embedded signing. This may cause issues getting the embedded URL.");
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
                        var viewUrl = envelopesApi.CreateRecipientView(_settings.AccountId, envelopeSummary.EnvelopeId, recipientViewRequest);
                        if (!string.IsNullOrEmpty(viewUrl?.Url))
                        {
                            signerUrls[request.LandlordEmail] = viewUrl.Url;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not generate signing URL for landlord {Email}", request.LandlordEmail);
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
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending document for signature via DocuSign");
                return ServiceResponse<SignatureEnvelopeDto>.CreateError(
                    "Error sending document for signature",
                    ex.Message,
                    ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<SignatureStatusDto>> GetSignatureStatus(string envelopeId)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync();
                var envelopesApi = new EnvelopesApi(apiClient);

                var envelope = envelopesApi.GetEnvelope(_settings.AccountId, envelopeId);

                if (envelope == null)
                {
                    return ServiceResponse<SignatureStatusDto>.CreateError(
                        "Envelope not found",
                        $"No envelope found with ID {envelopeId}",
                        statusCode: 404);
                }

                var signerStatuses = new Dictionary<string, SignerStatusDto>();

                // Get recipient statuses
                var recipients = envelopesApi.ListRecipients(_settings.AccountId, envelopeId);
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

                var result = new SignatureStatusDto
                {
                    EnvelopeId = envelopeId,
                    Status = envelope.Status?.ToLower() ?? "unknown",
                    SignerStatuses = signerStatuses,
                    CompletedAt = !string.IsNullOrEmpty(envelope.CompletedDateTime) && DateTime.TryParse(envelope.CompletedDateTime, out var completedDate)
                        ? completedDate
                        : null,
                    ExpiresAt = !string.IsNullOrEmpty(envelope.ExpireDateTime) && DateTime.TryParse(envelope.ExpireDateTime, out var expireDate)
                        ? expireDate
                        : null
                };

                return ServiceResponse<SignatureStatusDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting DocuSign envelope status for {EnvelopeId}", envelopeId);
                return ServiceResponse<SignatureStatusDto>.CreateError(
                    "Error retrieving signature status",
                    ex.Message,
                    ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<byte[]>> GetSignedDocument(string envelopeId)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync();
                var envelopesApi = new EnvelopesApi(apiClient);

                // Get the combined document (all pages with signatures)
                var document = envelopesApi.GetDocument(_settings.AccountId, envelopeId, "combined");

                if (document == null)
                {
                    return ServiceResponse<byte[]>.CreateError(
                        "Document not found",
                        $"No signed document found for envelope {envelopeId}",
                        statusCode: 404);
                }

                // Read the stream to bytes
                using var memoryStream = new MemoryStream();
                await document.CopyToAsync(memoryStream);
                var documentBytes = memoryStream.ToArray();

                return ServiceResponse<byte[]>.CreateSuccess(documentBytes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving signed document for envelope {EnvelopeId}", envelopeId);
                return ServiceResponse<byte[]>.CreateError(
                    "Error retrieving signed document",
                    ex.Message,
                    ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<bool>> CancelSignature(string envelopeId, string? reason = null)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync();
                var envelopesApi = new EnvelopesApi(apiClient);

                var envelopeUpdate = new Envelope
                {
                    Status = "voided",
                    VoidedReason = reason ?? "Cancelled by landlord"
                };

                envelopesApi.Update(_settings.AccountId, envelopeId, envelopeUpdate);

                _logger.LogInformation("Successfully voided DocuSign envelope {EnvelopeId}", envelopeId);

                return ServiceResponse<bool>.CreateSuccess(true, "Signature request cancelled successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling DocuSign envelope {EnvelopeId}", envelopeId);
                return ServiceResponse<bool>.CreateError(
                    "Error cancelling signature request",
                    ex.Message,
                    ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<bool>> ResendSignatureRequest(string envelopeId)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync();
                var envelopesApi = new EnvelopesApi(apiClient);

                // Get current envelope to verify it exists
                var envelope = envelopesApi.GetEnvelope(_settings.AccountId, envelopeId);
                if (envelope == null)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Envelope not found",
                        $"No envelope found with ID {envelopeId}",
                        statusCode: 404);
                }

                // Get recipients to resend to
                var recipients = envelopesApi.ListRecipients(_settings.AccountId, envelopeId);
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

                envelopesApi.Update(_settings.AccountId, envelopeId, envelopeUpdate);

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
                envelopesApi.UpdateRecipients(_settings.AccountId, envelopeId, recipientsUpdate);

                _logger.LogInformation("Successfully triggered resend for DocuSign envelope {EnvelopeId}", envelopeId);

                return ServiceResponse<bool>.CreateSuccess(true, "Signature request resent successfully to all recipients");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resending DocuSign envelope {EnvelopeId}", envelopeId);
                return ServiceResponse<bool>.CreateError(
                    "Error resending signature request",
                    ex.Message,
                    ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<string>> GetEmbeddedSigningUrl(string envelopeId, string recipientEmail, string recipientName, string returnUrl)
        {
            try
            {
                var apiClient = await GetAuthenticatedClientAsync();
                var envelopesApi = new EnvelopesApi(apiClient);

                // Check envelope status - it must be "sent" to get embedded signing URL
                var envelope = envelopesApi.GetEnvelope(_settings.AccountId, envelopeId);
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
                        envelopesApi.Update(_settings.AccountId, envelopeId, envelopeUpdate);
                        _logger.LogInformation("Updated envelope {EnvelopeId} status from 'created' to 'sent' for embedded signing", envelopeId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not update envelope {EnvelopeId} status to 'sent'. This may cause issues getting the embedded URL.", envelopeId);
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

                _logger.LogInformation("Requesting embedded signing URL for envelope {EnvelopeId}, recipient {Email}, ClientUserId {ClientUserId}",
                    envelopeId, recipientEmail, recipientEmail);

                // Create the recipient view (embedded signing URL)
                var viewUrl = envelopesApi.CreateRecipientView(_settings.AccountId, envelopeId, recipientViewRequest);

                if (string.IsNullOrEmpty(viewUrl?.Url))
                {
                    return ServiceResponse<string>.CreateError(
                        "Failed to generate embedded signing URL",
                        "DocuSign did not return a signing URL");
                }

                _logger.LogInformation("Successfully generated embedded signing URL for envelope {EnvelopeId}, recipient {Email}",
                    envelopeId, recipientEmail);

                return ServiceResponse<string>.CreateSuccess(viewUrl.Url, "Embedded signing URL generated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating embedded signing URL for envelope {EnvelopeId}, recipient {Email}",
                    envelopeId, recipientEmail);
                return ServiceResponse<string>.CreateError(
                    "Error generating embedded signing URL",
                    ex.Message,
                    ex.InnerException?.Message);
            }
        }
    }
}

