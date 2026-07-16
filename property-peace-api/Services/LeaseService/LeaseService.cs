
using AutoMapper;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Services.ESignatureService;
using brownstone_hub_api.Services.TenantDocumentService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Services.UserContextService;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Services.PaymentService;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace brownstone_hub_api.Services.LeaseService
{
    public class LeaseService(
        ILeaseRepository leaseRepository,
        IPropertyRepository propertyRepository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<LeaseService> logger,
        IMapper mapper,
        IESignatureService? eSignatureService,
        ITenantDocumentService? tenantDocumentService,
        BlobServiceClient? blobServiceClient,
        IConfiguration? configuration,
        INotificationService? notificationService,
        IUserService? userService,
        IUserContextService? userContextService,
        DataContext? dataContext,
        IPaymentRepository? paymentRepository,
        IPaymentService? paymentService,
        IEmailService? emailService) : ILeaseService
    {
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<LeaseService> _logger = logger;
        private readonly IMapper _mapper = mapper;
        private readonly IESignatureService? _eSignatureService = eSignatureService;
        private readonly ITenantDocumentService? _tenantDocumentService = tenantDocumentService;
        private readonly BlobServiceClient? _blobServiceClient = blobServiceClient;
        private readonly IConfiguration? _configuration = configuration;
        private readonly INotificationService? _notificationService = notificationService;
        private readonly IUserService? _userService = userService;
        private readonly IUserContextService? _userContextService = userContextService;
        private readonly DataContext? _dataContext = dataContext;
        private readonly IPaymentRepository? _paymentRepository = paymentRepository;
        private readonly IPaymentService? _paymentService = paymentService;
        private readonly IEmailService? _emailService = emailService;
        private const string SignedDocumentsContainerName = "signed-documents";

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadLeaseDto>> AddOrUpdateLease(UpdateLeaseDto lease)
        {
            try
            {
                var property = await _propertyRepository.GetPropertyById(lease.PropertyId);
                if (property == null)
                    return ServiceResponse<LoadLeaseDto>.CreateError("Invalid Property ID", "The specified property does not exist.");

                var unit = property.Units.FirstOrDefault(u => u.Id == lease.UnitId);
                if (unit == null)
                    return ServiceResponse<LoadLeaseDto>.CreateError("Invalid Unit ID", "The specified unit does not exist.");

                // Get organizationId from context
                var organizationId = GetOrganizationIdFromContext();

                LoadLeaseDto newLease;

                // If lease ID is provided, check if that specific lease exists and update it
                if (lease.Id > 0 && organizationId.HasValue)
                {
                    var existingLeaseById = await _leaseRepository.GetLeaseById(lease.Id, organizationId.Value);
                    if (existingLeaseById != null)
                    {
                        // Verify the lease belongs to the correct unit
                        if (existingLeaseById.UnitId != lease.UnitId)
                        {
                            return ServiceResponse<LoadLeaseDto>.CreateError("Invalid Unit", "The lease does not belong to the specified unit.");
                        }
                        newLease = await _leaseRepository.UpdateLease(lease);
                    }
                    else
                    {
                        return ServiceResponse<LoadLeaseDto>.CreateError("Lease not found", "The specified lease does not exist or does not belong to your organization.", statusCode: 404);
                    }
                }
                else
                {
                    // Check if lease already exists for the unit (filtered by organizationId)
                    var existingLease = await _leaseRepository.GetLease(lease.UnitId, organizationId);

                    if (existingLease != null)
                    {
                        lease.Id = existingLease.Id;
                        newLease = await _leaseRepository.UpdateLease(lease);
                    }
                    else
                    {
                        newLease = await _leaseRepository.AddLease(lease, organizationId);

                        var leaseHasStarted = lease.StartDate.HasValue && lease.StartDate.Value.Date <= DateTime.Today;
                        property.IsOccupied = leaseHasStarted;
                        unit.IsOccupied = leaseHasStarted;
                        await _propertyRepository.UpdateProperty(_mapper.Map<UpdatePropertyDto>(property));
                    }
                }

                // Generate past payments if requested (only if start date is in the past and dates are provided)
                if (lease.MarkPastPaymentsAsPaid && newLease != null && lease.StartDate.HasValue && lease.EndDate.HasValue)
                {
                    var startDate = lease.StartDate.Value.Date;
                    var today = DateTime.Today;

                    if (startDate < today)
                    {
                        await GeneratePastPaymentsAsync(newLease, lease);
                    }
                    else
                    {
                        _logger.LogInformation("Skipping past payment generation for lease {LeaseId}: Start date {StartDate} is not in the past (today is {Today})",
                            newLease.Id, startDate, today);
                    }
                }
                else if (lease.MarkPastPaymentsAsPaid && (!lease.StartDate.HasValue || !lease.EndDate.HasValue))
                {
                    _logger.LogInformation("Skipping past payment generation for lease {LeaseId}: Start date or end date not provided", newLease?.Id);
                }

                //var unit = await property.Units.FirstOrDefaultAsync(u => u.Id == lease.UnitId);
                return ServiceResponse<LoadLeaseDto>.CreateSuccess(newLease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding or updating lease");
                return ServiceResponse<LoadLeaseDto>.CreateError("Error adding or updating lease", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseDto>> GetLease(long unitId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var lease = await _leaseRepository.GetLease(unitId, organizationId);

                return ServiceResponse<LoadLeaseDto>.CreateSuccess(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease");
                return ServiceResponse<LoadLeaseDto>.CreateError("Error retrieving lease", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseDto>> GetLeaseById(long leaseId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadLeaseDto>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId.Value);
                if (lease == null)
                    return ServiceResponse<LoadLeaseDto>.CreateError("Lease not found", $"No lease found with ID {leaseId}", statusCode: 404);

                return ServiceResponse<LoadLeaseDto>.CreateSuccess(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease by ID {LeaseId}", leaseId);
                return ServiceResponse<LoadLeaseDto>.CreateError("Error retrieving lease", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseDto>> CompleteDraft(long leaseId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                    return ServiceResponse<LoadLeaseDto>.CreateError("Organization ID is required", "No organization context found", "", 400);
                var lease = await _leaseRepository.CompleteDraft(leaseId, organizationId.Value);
                return ServiceResponse<LoadLeaseDto>.CreateSuccess(lease, "Lease draft completed");
            }
            catch (KeyNotFoundException)
            {
                return ServiceResponse<LoadLeaseDto>.CreateError("Lease not found", $"No lease found with ID {leaseId}", statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error completing draft for lease {LeaseId}", leaseId);
                return ServiceResponse<LoadLeaseDto>.CreateError("Error completing draft", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseDto>> SetMoveInReportTemplateCompletedAt(long leaseId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                    return ServiceResponse<LoadLeaseDto>.CreateError("Organization ID is required", "No organization context found", "", 400);
                var lease = await _leaseRepository.SetMoveInReportTemplateCompletedAt(leaseId, organizationId.Value);
                return ServiceResponse<LoadLeaseDto>.CreateSuccess(lease, "Move-in report template step marked complete for this lease");
            }
            catch (Exception ex) when (ex.Message.Contains("Lease not found", StringComparison.OrdinalIgnoreCase))
            {
                return ServiceResponse<LoadLeaseDto>.CreateError("Lease not found", $"No lease found with ID {leaseId}", statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting move-in report template completed for lease {LeaseId}", leaseId);
                return ServiceResponse<LoadLeaseDto>.CreateError("Error updating lease", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseDto>> UpdateLeaseSignature(UpdateLeaseSignatureDto signatureInfo)
        {
            try
            {
                var lease = await _leaseRepository.UpdateLeaseSignature(signatureInfo);
                return ServiceResponse<LoadLeaseDto>.CreateSuccess(lease, "Lease signature information updated successfully");
            }
            catch (KeyNotFoundException)
            {
                return ServiceResponse<LoadLeaseDto>.CreateError("Lease not found", $"No lease found with ID {signatureInfo.LeaseId}", statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating lease signature for lease {LeaseId}", signatureInfo.LeaseId);
                return ServiceResponse<LoadLeaseDto>.CreateError("Error updating lease signature", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadLeaseDto>>> GetLeasesByLandlordId(long landlordId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadLeaseDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var leases = await _leaseRepository.GetLeasesByOrganizationId(organizationId.Value);
                return ServiceResponse<List<LoadLeaseDto>>.CreateSuccess(leases);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leases for landlord {LandlordId}", landlordId);
                return ServiceResponse<List<LoadLeaseDto>>.CreateError("Error retrieving leases", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseDto>> GetActiveLease(long propertyId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var lease = await _leaseRepository.GetActiveLease(propertyId, organizationId);

                return ServiceResponse<LoadLeaseDto>.CreateSuccess(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving active lease for property {PropertyId}", propertyId);
                return ServiceResponse<LoadLeaseDto>.CreateError("Error retrieving active lease", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseDto>> DeleteLease(long leaseId)
        {
            try
            {
                var lease = await _leaseRepository.DeleteLease(leaseId);
                return ServiceResponse<LoadLeaseDto>.CreateSuccess(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting lease with ID {LeaseId}", leaseId);
                return ServiceResponse<LoadLeaseDto>.CreateError("Error deleting lease", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadLeaseDto>>> GetLeasesByTenantUserId(long tenantUserId)
        {
            try
            {
                var leases = await _leaseRepository.GetLeasesByTenantUserId(tenantUserId);
                if (leases == null || !leases.Any())
                    return ServiceResponse<List<LoadLeaseDto>>.CreateError("Leases not found", $"No active leases found for tenant user with ID {tenantUserId}", statusCode: 404);

                return ServiceResponse<List<LoadLeaseDto>>.CreateSuccess(leases);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leases for tenant user {TenantUserId}", tenantUserId);
                return ServiceResponse<List<LoadLeaseDto>>.CreateError("Error retrieving leases", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseDto>> EndLease(long leaseId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadLeaseDto>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                // Verify the lease belongs to the organization
                var existingLease = await _leaseRepository.GetLeaseById(leaseId, organizationId.Value);
                if (existingLease == null)
                    return ServiceResponse<LoadLeaseDto>.CreateError("Lease not found", "Lease does not exist or does not belong to your organization", statusCode: 404);

                var lease = await _leaseRepository.EndLease(leaseId);
                return ServiceResponse<LoadLeaseDto>.CreateSuccess(lease, "Lease ended and archived successfully");
            }
            catch (KeyNotFoundException ex)
            {
                return ServiceResponse<LoadLeaseDto>.CreateError("Lease not found", ex.Message, statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ending lease with ID {LeaseId}", leaseId);
                return ServiceResponse<LoadLeaseDto>.CreateError("Error ending lease", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseDto>> ReopenLease(long leaseId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadLeaseDto>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                // Verify the lease belongs to the organization
                var existingLease = await _leaseRepository.GetLeaseById(leaseId, organizationId.Value);
                if (existingLease == null)
                    return ServiceResponse<LoadLeaseDto>.CreateError("Lease not found", "Lease does not exist or does not belong to your organization", statusCode: 404);

                var lease = await _leaseRepository.ReopenLease(leaseId);
                return ServiceResponse<LoadLeaseDto>.CreateSuccess(lease, "Lease reopened successfully");
            }
            catch (KeyNotFoundException ex)
            {
                return ServiceResponse<LoadLeaseDto>.CreateError("Lease not found", ex.Message, statusCode: 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reopening lease with ID {LeaseId}", leaseId);
                return ServiceResponse<LoadLeaseDto>.CreateError("Error reopening lease", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadLeaseDto>>> GetLeaseHistory()
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadLeaseDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var leaseHistory = await _leaseRepository.GetLeaseHistoryByOrganizationId(organizationId.Value);
                return ServiceResponse<List<LoadLeaseDto>>.CreateSuccess(leaseHistory);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease history");
                return ServiceResponse<List<LoadLeaseDto>>.CreateError("Error retrieving lease history", ex.Message, ex.InnerException?.Message);
            }
        }

        // Helper method to retrieve lease document from blob storage
        private async Task<(byte[]? documentBytes, string documentName)> GetLeaseDocumentAsync(long leaseId)
        {
            try
            {
                if (_tenantDocumentService == null || _blobServiceClient == null)
                {
                    return (null, "Lease Agreement.pdf");
                }

                var leaseAgreementResponse = await _tenantDocumentService.GetLeaseAgreementByLeaseId(leaseId);

                if (leaseAgreementResponse.Success && leaseAgreementResponse.Data != null)
                {
                    var leaseDoc = leaseAgreementResponse.Data;

                    if (!string.IsNullOrEmpty(leaseDoc.BlobName))
                    {
                        // Try both containers - lease documents and tenant documents
                        string[] containersToTry = { "tenant-documents", "lease-documents" };

                        foreach (var containerName in containersToTry)
                        {
                            try
                            {
                                var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
                                var blobClient = containerClient.GetBlobClient(leaseDoc.BlobName);

                                if (await blobClient.ExistsAsync())
                                {
                                    using var memoryStream = new MemoryStream();
                                    await blobClient.DownloadToAsync(memoryStream);
                                    var documentBytes = memoryStream.ToArray();
                                    var documentName = leaseDoc.FileName ?? "Lease Agreement.pdf";
                                    return (documentBytes, documentName);
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Failed to retrieve document from container {ContainerName}", containerName);
                                continue;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease document for lease {LeaseId}", leaseId);
            }

            return (null, "Lease Agreement.pdf");
        }

        private string GetFrontendBaseUrl(string? providedUrl)
        {
            if (!string.IsNullOrEmpty(providedUrl))
                return providedUrl;

            var frontendBaseUrl = _configuration?["FrontendBaseUrl"];
            if (!string.IsNullOrEmpty(frontendBaseUrl))
                return frontendBaseUrl;

            if (_httpContextAccessor?.HttpContext != null)
            {
                var request = _httpContextAccessor.HttpContext.Request;
                return request.IsHttps
                    ? $"https://{request.Host}"
                    : $"http://{request.Host}";
            }

            return "https://app.propertypeace.io"; // Fallback when no config (production)
        }

        public async Task<ServiceResponse<SignLandlordOnlyResultDto>> SignLandlordOnlyAsync(
            long leaseId,
            SendLeaseForSignatureDto request,
            string? frontendBaseUrl)
        {
            try
            {
                // Get the lease
                var leaseResponse = await GetLeaseById(leaseId);
                if (!leaseResponse.Success || leaseResponse.Data == null)
                {
                    return ServiceResponse<SignLandlordOnlyResultDto>.CreateError(
                        "Lease not found",
                        $"No lease found with ID {leaseId}",
                        "",
                        404
                    );
                }

                var lease = leaseResponse.Data;

                // Check if landlord already signed
                if (lease.LeaseAgreement?.LandlordSignedAt != null)
                {
                    return ServiceResponse<SignLandlordOnlyResultDto>.CreateError(
                        "Already signed",
                        "Landlord has already signed this lease.",
                        "",
                        400
                    );
                }

                // If envelope already exists, reuse it and get the embedded signing URL
                if (!string.IsNullOrEmpty(lease.LeaseAgreement?.DocuSignEnvelopeId) && _eSignatureService != null)
                {
                    var baseUrl = GetFrontendBaseUrl(frontendBaseUrl);
                    var returnUrl = $"{baseUrl.TrimEnd('/')}/landlord/leases/{leaseId}?signed=true";

                    var embeddedUrlResponse = await _eSignatureService.GetEmbeddedSigningUrl(
                        lease.LeaseAgreement.DocuSignEnvelopeId,
                        request.LandlordEmail,
                        request.LandlordName,
                        returnUrl
                    );

                    if (embeddedUrlResponse.Success && !string.IsNullOrEmpty(embeddedUrlResponse.Data))
                    {
                        return ServiceResponse<SignLandlordOnlyResultDto>.CreateSuccess(new SignLandlordOnlyResultDto
                        {
                            EnvelopeId = lease.LeaseAgreement.DocuSignEnvelopeId,
                            EmbeddedSigningUrl = embeddedUrlResponse.Data,
                            SignerUrls = new Dictionary<string, string> { { request.LandlordEmail, embeddedUrlResponse.Data } },
                            ExpiresAt = lease.LeaseAgreement.SignatureExpiresAt,
                            Message = "Using existing envelope. Use embeddedSigningUrl to sign directly in the app."
                        });
                    }
                    else
                    {
                        return ServiceResponse<SignLandlordOnlyResultDto>.CreateError(
                            "Failed to get signing URL",
                            "Failed to get signing URL for existing envelope",
                            embeddedUrlResponse.Errors?.Message ?? "",
                            500
                        );
                    }
                }

                // Get lease document
                var (documentBytes, documentName) = await GetLeaseDocumentAsync(leaseId);

                if (documentBytes == null || documentBytes.Length == 0)
                {
                    return ServiceResponse<SignLandlordOnlyResultDto>.CreateError(
                        "No document found",
                        "No lease document found. Please ensure the lease agreement has been generated.",
                        "",
                        400
                    );
                }

                if (_eSignatureService == null)
                {
                    return ServiceResponse<SignLandlordOnlyResultDto>.CreateError(
                        "Service unavailable",
                        "E-signature service is not configured.",
                        "",
                        500
                    );
                }

                // Create a request with only landlord (no tenants)
                var landlordOnlyRequest = new SendLeaseForSignatureDto
                {
                    LeaseId = request.LeaseId,
                    LandlordEmail = request.LandlordEmail,
                    LandlordName = request.LandlordName,
                    TenantSigners = new List<TenantSignerDto>(), // Empty - landlord only
                    EmailSubject = request.EmailSubject ?? "Please sign this lease agreement",
                    EmailMessage = request.EmailMessage ?? "Please review and sign the attached lease agreement.",
                    ExpirationDays = request.ExpirationDays,
                    RequireAllSigners = true,
                    UseEmbeddedSigning = true // Enable embedded signing for in-app signing
                };

                // Send to DocuSign (landlord only)
                var signatureResponse = await _eSignatureService.SendForSignature(landlordOnlyRequest, documentBytes, documentName);

                if (!signatureResponse.Success)
                {
                    return ServiceResponse<SignLandlordOnlyResultDto>.CreateError(
                        signatureResponse.Message,
                        signatureResponse.Errors?.Message ?? "",
                        "",
                        signatureResponse.StatusCode
                    );
                }

                // Update lease with signature information (but status is still "Not Sent" to tenants)
                var signatureInfo = new UpdateLeaseSignatureDto
                {
                    LeaseId = lease.Id,
                    SignatureStatus = ESignatureStatus.NotSent, // Not sent to tenants yet
                    DocuSignEnvelopeId = signatureResponse.Data?.EnvelopeId,
                    SignatureSentAt = null, // Not sent to tenants yet
                    SignatureExpiresAt = signatureResponse.Data?.ExpiresAt
                };

                await UpdateLeaseSignature(signatureInfo);

                // Generate embedded signing URL for in-app signing
                if (!string.IsNullOrEmpty(signatureResponse.Data?.EnvelopeId))
                {
                    var baseUrl = GetFrontendBaseUrl(frontendBaseUrl);
                    var returnUrl = $"{baseUrl.TrimEnd('/')}/landlord/leases/{leaseId}?signed=true";

                    var embeddedUrlResponse = await _eSignatureService.GetEmbeddedSigningUrl(
                        signatureResponse.Data.EnvelopeId,
                        request.LandlordEmail,
                        request.LandlordName,
                        returnUrl
                    );

                    if (embeddedUrlResponse.Success && !string.IsNullOrEmpty(embeddedUrlResponse.Data))
                    {
                        return ServiceResponse<SignLandlordOnlyResultDto>.CreateSuccess(new SignLandlordOnlyResultDto
                        {
                            EnvelopeId = signatureResponse.Data.EnvelopeId,
                            EmbeddedSigningUrl = embeddedUrlResponse.Data,
                            SignerUrls = signatureResponse.Data.SignerUrls,
                            ExpiresAt = signatureResponse.Data.ExpiresAt,
                            Message = "Lease envelope created. Use embeddedSigningUrl to sign directly in the app."
                        });
                    }
                    else
                    {
                        _logger.LogError("Failed to generate embedded signing URL for envelope {EnvelopeId}. Error: {Error}",
                            signatureResponse.Data.EnvelopeId,
                            embeddedUrlResponse.Message);

                        return ServiceResponse<SignLandlordOnlyResultDto>.CreateError(
                            "Failed to generate signing URL",
                            "Failed to generate embedded signing URL. Please try again or contact support.",
                            embeddedUrlResponse.Errors?.Message ?? "",
                            500
                        );
                    }
                }

                return ServiceResponse<SignLandlordOnlyResultDto>.CreateError(
                    "Failed to create signing session",
                    "Failed to create signing session. Please try again.",
                    "",
                    500
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error signing landlord only for lease {LeaseId}", leaseId);
                return ServiceResponse<SignLandlordOnlyResultDto>.CreateError(
                    "Error signing lease",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }

        public async Task<ServiceResponse<Services.ESignatureService.SignatureEnvelopeDto>> SendLeaseForSignatureAsync(
            long leaseId,
            SendLeaseForSignatureDto request,
            long landlordId,
            long? organizationId)
        {
            try
            {
                // Get the lease
                var leaseResponse = await GetLeaseById(leaseId);
                if (!leaseResponse.Success || leaseResponse.Data == null)
                {
                    return ServiceResponse<Services.ESignatureService.SignatureEnvelopeDto>.CreateError(
                        "Lease not found",
                        $"No lease found with ID {leaseId}",
                        "",
                        404
                    );
                }

                var lease = leaseResponse.Data;

                // Get lease document from tenant documents
                byte[]? documentBytes = null;
                string documentName = "Lease Agreement.pdf";

                if (lease.Tenants != null && lease.Tenants.Any() && _tenantDocumentService != null)
                {
                    var firstTenant = lease.Tenants.First();
                    var tenantDocsResponse = await _tenantDocumentService.GetTenantDocumentsByTenantId(firstTenant.Id);

                    if (tenantDocsResponse.Success && tenantDocsResponse.Data != null)
                    {
                        var leaseDoc = tenantDocsResponse.Data
                            .FirstOrDefault(d => d.DocumentType == ETenantDocumentType.LeaseAgreement &&
                                               (d.LeaseId == leaseId || d.LeaseId == null));

                        if (leaseDoc != null && !string.IsNullOrEmpty(leaseDoc.BlobName) && _blobServiceClient != null)
                        {
                            try
                            {
                                var containerClient = _blobServiceClient.GetBlobContainerClient("tenant-documents");
                                var blobClient = containerClient.GetBlobClient(leaseDoc.BlobName);

                                if (await blobClient.ExistsAsync())
                                {
                                    using var memoryStream = new MemoryStream();
                                    await blobClient.DownloadToAsync(memoryStream);
                                    documentBytes = memoryStream.ToArray();
                                    documentName = leaseDoc.FileName;
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Error retrieving lease document from storage");
                                return ServiceResponse<Services.ESignatureService.SignatureEnvelopeDto>.CreateError(
                                    "Error retrieving document",
                                    "Error retrieving lease document from storage",
                                    ex.Message,
                                    500
                                );
                            }
                        }
                    }
                }

                // If no document found, return error
                if (documentBytes == null || documentBytes.Length == 0)
                {
                    return ServiceResponse<Services.ESignatureService.SignatureEnvelopeDto>.CreateError(
                        "No document found",
                        "No lease document found. Please upload a lease agreement document first before sending for signature.",
                        "",
                        400
                    );
                }

                if (_eSignatureService == null)
                {
                    return ServiceResponse<Services.ESignatureService.SignatureEnvelopeDto>.CreateError(
                        "Service unavailable",
                        "E-signature service is not configured.",
                        "",
                        500
                    );
                }

                // Send to DocuSign
                var signatureResponse = await _eSignatureService.SendForSignature(request, documentBytes, documentName);

                if (!signatureResponse.Success)
                {
                    return signatureResponse;
                }

                // Update lease with signature information
                var signatureInfo = new UpdateLeaseSignatureDto
                {
                    LeaseId = lease.Id,
                    SignatureStatus = ESignatureStatus.Sent,
                    DocuSignEnvelopeId = signatureResponse.Data?.EnvelopeId,
                    SignatureSentAt = DateTime.UtcNow,
                    SignatureExpiresAt = signatureResponse.Data?.ExpiresAt
                };

                await UpdateLeaseSignature(signatureInfo);

                // Send notifications to all tenants on the lease
                if (lease.Tenants != null && lease.Tenants.Any() && request.TenantSigners != null && request.TenantSigners.Any() && _notificationService != null)
                {
                    try
                    {
                        // Format property reference
                        var propertyRef = lease.PropertyType == "MultiUnit" && !string.IsNullOrEmpty(lease.UnitName)
                            ? $"{lease.PropertyName} - {lease.UnitName}"
                            : lease.PropertyName;

                        // Get landlord name for notification
                        string? landlordName = null;
                        if (_userService != null)
                        {
                            try
                            {
                                var landlordResponse = await _userService.GetUserByIdAsync(landlordId);
                                if (landlordResponse.Success && landlordResponse.Data != null)
                                {
                                    landlordName = !string.IsNullOrEmpty(landlordResponse.Data.Firstname)
                                        ? $"{landlordResponse.Data.Firstname} {landlordResponse.Data.Lastname}".Trim()
                                        : landlordResponse.Data.Email;
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Failed to get landlord name for notification");
                            }
                        }

                        foreach (var tenantSigner in request.TenantSigners)
                        {
                            var tenant = lease.Tenants.FirstOrDefault(t => t.Id == tenantSigner.TenantId);
                            if (tenant == null || !tenant.UserId.HasValue) continue;

                            try
                            {
                                var notificationDto = new CreateNotificationDto
                                {
                                    UserId = tenant.UserId.Value,
                                    OrganizationId = organizationId,
                                    Type = ENotificationType.Lease,
                                    Title = "Lease Sent for Signature",
                                    Message = $"A lease agreement for {propertyRef} has been sent to you for signature. Please check your email for the signing link.",
                                    RelatedId = lease.Id,
                                    SendEmail = true,
                                    SendSMS = false,
                                    PerformedByUserId = landlordId,
                                    PerformedByName = landlordName
                                };

                                await _notificationService.CreateNotification(notificationDto);
                                _logger.LogInformation("Notification sent to tenant UserId {UserId} for lease {LeaseId}", tenant.UserId.Value, lease.Id);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Failed to send notification to tenant UserId {UserId} for lease {LeaseId}", tenant.UserId.Value, lease.Id);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error sending notifications for lease {LeaseId}", lease.Id);
                        // Continue even if notifications fail
                    }
                }

                return signatureResponse;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending lease for signature {LeaseId}", leaseId);
                return ServiceResponse<Services.ESignatureService.SignatureEnvelopeDto>.CreateError(
                    "Error sending lease for signature",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }

        public async Task<ServiceResponse<SyncSignatureStatusResultDto>> SyncLeaseSignatureStatusAsync(
            long leaseId,
            string? landlordEmail)
        {
            if (_eSignatureService == null || _dataContext == null || _blobServiceClient == null)
            {
                return ServiceResponse<SyncSignatureStatusResultDto>.CreateError(
                    "Service unavailable",
                    "Required services are not configured.",
                    "",
                    500
                );
            }

            var leaseResponse = await GetLeaseById(leaseId);
            if (!leaseResponse.Success || leaseResponse.Data == null)
            {
                return ServiceResponse<SyncSignatureStatusResultDto>.CreateError(
                    "Lease not found",
                    $"No lease found with ID {leaseId}",
                    "",
                    404
                );
            }

            string? landlordSignedByName = null;
            if (_userContextService != null)
            {
                var currentUser = await _userContextService.GetCurrentUserAsync();
                if (currentUser != null)
                {
                    landlordSignedByName = !string.IsNullOrEmpty(currentUser.Firstname)
                        ? $"{currentUser.Firstname} {currentUser.Lastname}".Trim()
                        : currentUser.Email;
                    if (string.IsNullOrEmpty(landlordSignedByName))
                        landlordSignedByName = currentUser.Email;
                }
            }

            return await SyncLeaseSignatureStatusCoreAsync(leaseResponse.Data, landlordEmail, landlordSignedByName);
        }

        public async Task<ServiceResponse<SyncSignatureStatusResultDto>> SyncLeaseSignatureStatusFromConnectAsync(long leaseId, long organizationId)
        {
            if (_eSignatureService == null || _dataContext == null || _blobServiceClient == null)
            {
                return ServiceResponse<SyncSignatureStatusResultDto>.CreateError(
                    "Service unavailable",
                    "Required services are not configured.",
                    "",
                    500
                );
            }

            var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId);
            if (lease == null)
            {
                return ServiceResponse<SyncSignatureStatusResultDto>.CreateError(
                    "Lease not found",
                    $"No lease found with ID {leaseId}",
                    "",
                    404
                );
            }

            return await SyncLeaseSignatureStatusCoreAsync(lease, landlordEmail: null, landlordSignedByName: null);
        }

        private async Task<ServiceResponse<SyncSignatureStatusResultDto>> SyncLeaseSignatureStatusCoreAsync(
            LoadLeaseDto lease,
            string? landlordEmail,
            string? landlordSignedByName)
        {
            try
            {
                // Check if lease has a DocuSign envelope
                if (string.IsNullOrEmpty(lease.LeaseAgreement?.DocuSignEnvelopeId))
                {
                    return ServiceResponse<SyncSignatureStatusResultDto>.CreateError(
                        "No envelope",
                        "Lease does not have a DocuSign envelope",
                        "",
                        400
                    );
                }

                // Get signature status from DocuSign
                var statusResponse = await _eSignatureService.GetSignatureStatus(lease.LeaseAgreement.DocuSignEnvelopeId);
                if (!statusResponse.Success)
                {
                    return ServiceResponse<SyncSignatureStatusResultDto>.CreateError(
                        statusResponse.Message,
                        statusResponse.Errors?.Message ?? "",
                        "",
                        statusResponse.StatusCode
                    );
                }

                var status = statusResponse.Data;

                // Check if landlord has signed
                DateTime? landlordSignedAt = null;
                if (status.SignerStatuses != null && status.SignerStatuses.Any())
                {
                    // Try to match by email (case-insensitive)
                    if (!string.IsNullOrEmpty(landlordEmail))
                    {
                        var matchingSigner = status.SignerStatuses.FirstOrDefault(s =>
                            string.Equals(s.Key, landlordEmail, StringComparison.OrdinalIgnoreCase));

                        if (!string.IsNullOrEmpty(matchingSigner.Key))
                        {
                            var landlordStatus = matchingSigner.Value;
                            if ((landlordStatus.Status == "signed" || landlordStatus.Status == "completed") && landlordStatus.SignedAt.HasValue)
                            {
                                landlordSignedAt = landlordStatus.SignedAt;
                                _logger.LogInformation("Found landlord signature by email match: {Email}, Status: {Status}, SignedAt: {SignedAt}",
                                    matchingSigner.Key, landlordStatus.Status, landlordStatus.SignedAt);
                            }
                        }
                    }

                    // If no match by email, check if this is a landlord-only envelope (only one signer)
                    if (!landlordSignedAt.HasValue && status.SignerStatuses.Count == 1)
                    {
                        var onlySigner = status.SignerStatuses.First();
                        if ((onlySigner.Value.Status == "signed" || onlySigner.Value.Status == "completed") && onlySigner.Value.SignedAt.HasValue)
                        {
                            landlordSignedAt = onlySigner.Value.SignedAt;
                            _logger.LogInformation("Found landlord signature (single signer): {Email}, Status: {Status}, SignedAt: {SignedAt}",
                                onlySigner.Key, onlySigner.Value.Status, onlySigner.Value.SignedAt);
                        }
                    }

                    // Also check envelope status - if envelope is "completed", check all signers
                    if (!landlordSignedAt.HasValue && status.Status == "completed" && status.SignerStatuses.Any())
                    {
                        var signedSigner = status.SignerStatuses.FirstOrDefault(s =>
                            (s.Value.Status == "signed" || s.Value.Status == "completed") && s.Value.SignedAt.HasValue);

                        if (!string.IsNullOrEmpty(signedSigner.Key))
                        {
                            landlordSignedAt = signedSigner.Value.SignedAt;
                            _logger.LogInformation("Found landlord signature (envelope completed): {Email}, Status: {Status}, SignedAt: {SignedAt}",
                                signedSigner.Key, signedSigner.Value.Status, signedSigner.Value.SignedAt);
                        }
                    }
                }

                // Update tenant signatures via TenantLease
                int tenantSignaturesUpdated = 0;
                var tenantLeases = await _dataContext.TenantLeases
                    .Include(tl => tl.Tenant)
                    .Where(tl => tl.LeaseId == lease.Id && !tl.Tenant.IsDeleted)
                    .ToListAsync();

                if (tenantLeases.Any() && status.SignerStatuses != null && status.SignerStatuses.Any())
                {
                    foreach (var tenantLease in tenantLeases)
                    {
                        var tenant = tenantLease.Tenant;
                        if (string.IsNullOrWhiteSpace(tenant.Email))
                            continue;

                        var matchingSigner = status.SignerStatuses.FirstOrDefault(s =>
                            string.Equals(s.Key, tenant.Email, StringComparison.OrdinalIgnoreCase));

                        if (!string.IsNullOrEmpty(matchingSigner.Key))
                        {
                            var signerStatus = matchingSigner.Value;
                            if ((signerStatus.Status == "signed" || signerStatus.Status == "completed") &&
                                signerStatus.SignedAt.HasValue)
                            {
                                if (!tenantLease.TenantSignedAt.HasValue || tenantLease.TenantSignedAt != signerStatus.SignedAt)
                                {
                                    tenantLease.TenantSignedAt = signerStatus.SignedAt;
                                    tenantSignaturesUpdated++;
                                    _logger.LogInformation("Updated tenant signature: TenantId={TenantId}, LeaseId={LeaseId}, Email={Email}, SignedAt={SignedAt}",
                                        tenant.Id, lease.Id, tenant.Email, signerStatus.SignedAt);
                                }
                            }
                        }
                    }

                    if (tenantSignaturesUpdated > 0)
                    {
                        await _dataContext.SaveChangesAsync();
                        _logger.LogInformation("Updated {Count} tenant signature(s) for lease {LeaseId}",
                            tenantSignaturesUpdated, lease.Id);
                    }
                }

                // Download and store signed document if landlord has signed or envelope is completed
                string? signedDocumentBlobName = lease.LeaseAgreement?.SignedDocumentBlobName;
                string? signedDocumentBlobUrl = lease.LeaseAgreement?.SignedDocumentBlobUrl;
                bool signedDocumentDownloaded = false;

                bool shouldDownloadDocument = false;
                if (landlordSignedAt.HasValue && string.IsNullOrEmpty(lease.LeaseAgreement?.SignedDocumentBlobName))
                {
                    shouldDownloadDocument = true;
                    _logger.LogInformation("Landlord signed lease {LeaseId}, downloading document with landlord signature", lease.Id);
                }
                else if (status.Status == "completed" && string.IsNullOrEmpty(lease.LeaseAgreement?.SignedDocumentBlobName))
                {
                    shouldDownloadDocument = true;
                    _logger.LogInformation("Envelope {EnvelopeId} is completed, downloading signed document", lease.LeaseAgreement?.DocuSignEnvelopeId);
                }

                if (shouldDownloadDocument)
                {
                    try
                    {
                        var signedDocumentResponse = await _eSignatureService.GetSignedDocument(lease.LeaseAgreement!.DocuSignEnvelopeId!);

                        if (signedDocumentResponse.Success && signedDocumentResponse.Data != null)
                        {
                            var containerClient = _blobServiceClient.GetBlobContainerClient(SignedDocumentsContainerName);
                            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                            var blobName = $"lease-{lease.Id}-signed-{Guid.NewGuid()}.pdf";
                            var blobClient = containerClient.GetBlobClient(blobName);

                            using (var stream = new MemoryStream(signedDocumentResponse.Data))
                            {
                                var uploadOptions = new BlobUploadOptions
                                {
                                    HttpHeaders = new BlobHttpHeaders { ContentType = "application/pdf" },
                                    Conditions = null
                                };
                                await blobClient.UploadAsync(stream, uploadOptions);
                            }

                            signedDocumentBlobName = blobName;
                            signedDocumentBlobUrl = blobClient.Uri.ToString();
                            signedDocumentDownloaded = true;

                            _logger.LogInformation("Successfully uploaded signed document for lease {LeaseId} to blob storage: {BlobName}",
                                lease.Id, blobName);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error downloading/uploading signed document for lease {LeaseId}", lease.Id);
                    }
                }

                // Map DocuSign status to ESignatureStatus
                var signatureStatus = status.Status?.ToLower() switch
                {
                    "sent" => ESignatureStatus.Sent,
                    "delivered" => ESignatureStatus.InProgress,
                    "signed" => ESignatureStatus.PartiallySigned,
                    "completed" => ESignatureStatus.Completed,
                    "declined" => ESignatureStatus.Declined,
                    "voided" => ESignatureStatus.Cancelled,
                    _ => ESignatureStatus.NotSent
                };

                // Update lease signature information (landlordSignedByName passed from caller or from Connect as null → use lease.LandlordSignedBy)
                var signatureInfo = new UpdateLeaseSignatureDto
                {
                    LeaseId = lease.Id,
                    SignatureStatus = signatureStatus,
                    DocuSignEnvelopeId = lease.LeaseAgreement?.DocuSignEnvelopeId,
                    SignatureCompletedAt = status.CompletedAt,
                    SignatureExpiresAt = status.ExpiresAt,
                    LandlordSignedAt = landlordSignedAt ?? lease.LeaseAgreement?.LandlordSignedAt,
                    LandlordSignedBy = landlordSignedByName ?? lease.LeaseAgreement?.LandlordSignedBy
                };

                await UpdateLeaseSignature(signatureInfo);

                // Update signed document info if we downloaded it
                if (signedDocumentDownloaded && !string.IsNullOrEmpty(signedDocumentBlobName))
                {
                    var agreementEntity = await _dataContext.LeaseAgreements.FirstOrDefaultAsync(la => la.LeaseId == lease.Id);
                    if (agreementEntity != null)
                    {
                        agreementEntity.SignedDocumentBlobName = signedDocumentBlobName;
                        agreementEntity.SignedDocumentBlobUrl = signedDocumentBlobUrl;
                        await _dataContext.SaveChangesAsync();
                        _logger.LogInformation("Updated lease {LeaseId} with signed document info", lease.Id);
                    }
                }

                return ServiceResponse<SyncSignatureStatusResultDto>.CreateSuccess(new SyncSignatureStatusResultDto
                {
                    LandlordSignedAt = signatureInfo.LandlordSignedAt,
                    SignatureStatus = signatureStatus,
                    TenantSignaturesUpdated = tenantSignaturesUpdated,
                    SignedDocumentDownloaded = signedDocumentDownloaded
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing signature status for lease {LeaseId}", lease.Id);
                return ServiceResponse<SyncSignatureStatusResultDto>.CreateError(
                    "Error syncing signature status",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }

        /// <summary>
        /// Generates payment records for all past periods from lease start date to today
        /// </summary>
        private async Task GeneratePastPaymentsAsync(LoadLeaseDto lease, UpdateLeaseDto leaseDto)
        {
            if (_paymentRepository == null || lease == null || leaseDto == null)
            {
                _logger.LogWarning("Cannot generate past payments: PaymentRepository is not available or lease data is missing");
                return;
            }

            try
            {
                // Check if dates are provided
                if (!leaseDto.StartDate.HasValue || !leaseDto.EndDate.HasValue)
                {
                    _logger.LogInformation("Cannot generate past payments for lease {LeaseId}: Start date or end date not provided", lease.Id);
                    return;
                }

                // Normalize dates to ensure proper comparison (remove time components)
                var startDate = leaseDto.StartDate.Value.Date;
                var endDate = leaseDto.EndDate.Value.Date;
                var today = DateTime.Today;

                _logger.LogInformation("Generating past payments for lease {LeaseId}: StartDate={StartDate}, Today={Today}, MarkPastPaymentsAsPaid={MarkPastPaymentsAsPaid}",
                    lease.Id, startDate, today, leaseDto.MarkPastPaymentsAsPaid);

                var paymentDates = CalculatePaymentDates(startDate, leaseDto.RentDueDay ?? 1, leaseDto.RentFrequency ?? "Monthly", today, endDate);

                _logger.LogInformation("Calculated {Count} payment dates for lease {LeaseId}", paymentDates.Count, lease.Id);

                if (paymentDates.Count == 0)
                {
                    _logger.LogInformation("No past payment dates to generate for lease {LeaseId}: StartDate={StartDate}, Today={Today}", lease.Id, startDate, today);
                    return;
                }

                // Get current user ID for CreatedByUserId
                long? userId = null;
                if (_userContextService != null)
                {
                    userId = await _userContextService.GetCurrentUserIdAsync();
                }

                // Create payment for each date
                foreach (var paymentDate in paymentDates)
                {
                    try
                    {
                        var addPaymentDto = new AddPaymentDto
                        {
                            LeaseId = lease.Id,
                            PaymentDate = paymentDate,
                            Amount = leaseDto.RentAmount ?? 0m,
                            Method = "Manual Entry",
                            CreatedByUserId = userId,
                            Reference = $"Past payment for {paymentDate:yyyy-MM-dd}"
                        };

                        // Use PaymentService to ensure ledger entries are created
                        if (_paymentService != null)
                        {
                            await _paymentService.AddPayment(addPaymentDto);
                        }
                        else if (_paymentRepository != null)
                        {
                            // Fallback to repository if service not available
                            await _paymentRepository.AddPayment(addPaymentDto);
                        }
                        _logger.LogInformation("Created past payment for lease {LeaseId} on {PaymentDate}", lease.Id, paymentDate);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to create payment for lease {LeaseId} on {PaymentDate}", lease.Id, paymentDate);
                        // Continue with other payments even if one fails
                    }
                }

                _logger.LogInformation("Successfully generated {Count} past payments for lease {LeaseId}", paymentDates.Count, lease.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating past payments for lease {LeaseId}", lease.Id);
                // Don't throw - we don't want to fail lease creation if payment generation fails
            }
        }

        /// <summary>
        /// Calculates payment dates from lease start date to today (or lease end date, whichever is earlier)
        /// First payment is on lease start date, subsequent payments follow rent frequency and due day
        /// </summary>
        private List<DateTime> CalculatePaymentDates(DateTime leaseStartDate, int rentDueDay, string rentFrequency, DateTime today, DateTime leaseEndDate)
        {
            var paymentDates = new List<DateTime>();

            if (leaseStartDate >= today)
            {
                return paymentDates; // No past dates to generate
            }

            // Determine end date (today or lease end, whichever is earlier)
            var effectiveEndDate = today < leaseEndDate ? today : leaseEndDate;

            // First payment is always on lease start date
            paymentDates.Add(leaseStartDate.Date);

            // Calculate subsequent payment dates based on frequency
            var frequency = (rentFrequency ?? "Monthly").Trim().ToLowerInvariant();
            var nextPaymentDate = leaseStartDate.Date;

            while (true)
            {
                DateTime nextDate;

                switch (frequency)
                {
                    case "monthly":
                        nextDate = nextPaymentDate.AddMonths(1);
                        break;
                    case "quarterly":
                        nextDate = nextPaymentDate.AddMonths(3);
                        break;
                    case "yearly":
                        nextDate = nextPaymentDate.AddYears(1);
                        break;
                    default:
                        nextDate = nextPaymentDate.AddMonths(1); // Default to monthly
                        break;
                }

                // Set the due day for the next payment
                var targetDay = Math.Min(rentDueDay, DateTime.DaysInMonth(nextDate.Year, nextDate.Month));
                nextDate = new DateTime(nextDate.Year, nextDate.Month, targetDay);

                // Stop if we've exceeded today or lease end date
                if (nextDate > effectiveEndDate)
                {
                    break;
                }

                // Only add if it's in the past (before today)
                if (nextDate < today)
                {
                    paymentDates.Add(nextDate);
                }
                else
                {
                    break;
                }

                nextPaymentDate = nextDate;
            }

            return paymentDates;
        }

        /// <summary>
        /// Sends "lease added" notification email to existing tenants when they are added to a lease
        /// </summary>
        public async Task SendLeaseAddedNotificationAsync(long leaseId, long tenantId, long? organizationId = null)
        {
            if (_emailService == null || _configuration == null || _dataContext == null)
            {
                _logger.LogWarning("EmailService, Configuration, or DataContext not available. Cannot send lease added notification.");
                return;
            }

            try
            {
                // Get lease with property and unit info
                if (!organizationId.HasValue)
                {
                    _logger.LogWarning("Organization ID not available for lease added notification");
                    return;
                }

                var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId.Value);
                if (lease == null)
                {
                    _logger.LogWarning("Lease {LeaseId} not found for lease added notification", leaseId);
                    return;
                }

                // Get tenant with user info
                var tenant = await _dataContext.Tenants
                    .Include(t => t.TenantLeases)
                    .Include(t => t.Unit)
                        .ThenInclude(u => u.Property)
                    .FirstOrDefaultAsync(t => t.Id == tenantId && !t.IsDeleted);

                if (tenant == null || !tenant.UserId.HasValue || string.IsNullOrEmpty(tenant.Email))
                {
                    _logger.LogWarning("Tenant {TenantId} not found, has no UserId, or has no email for lease added notification", tenantId);
                    return;
                }

                // Get landlord info
                string landlordName = "Your Landlord";
                string landlordEmail = "";
                if (lease.PropertyId > 0)
                {
                    var property = await _propertyRepository.GetPropertyById(lease.PropertyId);
                    if (property != null && property.LandlordId > 0 && _userService != null)
                    {
                        var landlordResponse = await _userService.GetUserByIdAsync(property.LandlordId);
                        if (landlordResponse.Success && landlordResponse.Data != null)
                        {
                            var landlord = landlordResponse.Data;
                            landlordName = !string.IsNullOrEmpty(landlord.Firstname)
                                ? $"{landlord.Firstname} {landlord.Lastname}".Trim()
                                : landlord.Email ?? "Your Landlord";
                            landlordEmail = landlord.Email ?? "";
                        }
                    }
                }

                // Format property reference
                var propertyRef = lease.PropertyType == "MultiUnit" && !string.IsNullOrEmpty(lease.UnitName)
                    ? $"{lease.PropertyName} - {lease.UnitName}"
                    : lease.PropertyName ?? "the property";

                var tenantName = $"{tenant.Firstname} {tenant.Lastname}".Trim();
                if (string.IsNullOrEmpty(tenantName))
                {
                    tenantName = "Tenant";
                }

                // Get frontend base URL
                var frontendBaseUrl = _configuration["FrontendBaseUrl"] ?? "http://localhost:3000";
                var viewLeaseUrl = $"{frontendBaseUrl.TrimEnd('/')}/tenant/lease-added/{leaseId}";

                // Create email subject and body
                var subject = $"You've Been Added to a Lease - {propertyRef}";
                var htmlBody = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #4A90E2; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; background-color: #f9f9f9; }}
        .button {{ display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h2>New Lease Added</h2>
        </div>
        <div class='content'>
            <p>Hello {tenantName},</p>
            <p><strong>{landlordName}</strong>{(string.IsNullOrEmpty(landlordEmail) ? "" : $" ({landlordEmail})")} has added you to a lease for <strong>{propertyRef}</strong>.</p>
            <p>Click the link below to view your lease details:</p>
            <p style='text-align: center;'>
                <a href='{viewLeaseUrl}' class='button'>View Lease</a>
            </p>
            <p>You can now access lease information, payment history, and submit maintenance requests for this property.</p>
            <p>If you have any questions, please contact {landlordName}.</p>
        </div>
        <div class='footer'>
            <p>This is an automated email from Property Peace. Please do not reply to this message.</p>
        </div>
    </div>
</body>
</html>";

                var plainTextBody = $@"
Hello {tenantName},

{landlordName}{(string.IsNullOrEmpty(landlordEmail) ? "" : $" ({landlordEmail})")} has added you to a lease for {propertyRef}.

Click the link below to view your lease details:
{viewLeaseUrl}

You can now access lease information, payment history, and submit maintenance requests for this property.

If you have any questions, please contact {landlordName}.

This is an automated email from Property Peace. Please do not reply to this message.";

                // Send email
                var emailSent = await _emailService.SendEmailAsync(
                    to: tenant.Email,
                    subject: subject,
                    htmlContent: htmlBody,
                    plainTextContent: plainTextBody
                );

                if (emailSent)
                {
                    _logger.LogInformation("Lease added notification email sent successfully to tenant {TenantId} ({Email}) for lease {LeaseId}",
                        tenantId, tenant.Email, leaseId);
                }
                else
                {
                    _logger.LogWarning("Failed to send lease added notification email to tenant {TenantId} ({Email}) for lease {LeaseId}",
                        tenantId, tenant.Email, leaseId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending lease added notification to tenant {TenantId} for lease {LeaseId}", tenantId, leaseId);
            }
        }

        public async Task<ServiceResponse<bool>> RemoveTenantFromLease(long leaseId, long tenantId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                // Verify the lease belongs to the organization
                var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId.Value);
                if (lease == null)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Lease not found",
                        "Lease does not exist or does not belong to your organization",
                        statusCode: 404
                    );
                }

                // Remove the tenant from this specific lease only
                var removed = await _leaseRepository.RemoveTenantFromLease(leaseId, tenantId);

                if (!removed)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Tenant not found on lease",
                        "The specified tenant is not associated with this lease",
                        statusCode: 404
                    );
                }

                return ServiceResponse<bool>.CreateSuccess(true, "Tenant removed from lease successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing tenant {TenantId} from lease {LeaseId}", tenantId, leaseId);
                return ServiceResponse<bool>.CreateError(
                    "Error removing tenant from lease",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }

        public async Task<ServiceResponse<bool>> AddTenantToLease(long leaseId, long tenantId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId.Value);
                if (lease == null)
                {
                    return ServiceResponse<bool>.CreateError("Lease not found", "Lease does not exist or does not belong to your organization", statusCode: 404);
                }

                var added = await _leaseRepository.AddTenantToLease(leaseId, tenantId);
                return ServiceResponse<bool>.CreateSuccess(added, added ? "Tenant added to lease successfully" : "Tenant already on lease");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding tenant {TenantId} to lease {LeaseId}", tenantId, leaseId);
                return ServiceResponse<bool>.CreateError("Error adding tenant to lease", ex.Message, ex.InnerException?.Message);
            }
        }
    }
}