using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using brownstone_hub_api.Dtos.TenantDocument;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.TenantDocuments;
using brownstone_hub_api.Repositories.LeaseInstances;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.LeaseService;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace brownstone_hub_api.Services.TenantDocumentService
{
    public class TenantDocumentService(
        BlobServiceClient blobServiceClient,
        IAzureBlobService azureBlobService,
        ITenantDocumentRepository tenantDocumentRepository,
        IServiceProvider serviceProvider,
        ILeaseInstanceRepository leaseInstanceRepository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<TenantDocumentService> logger) : ITenantDocumentService
    {
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly ITenantDocumentRepository _tenantDocumentRepository = tenantDocumentRepository;
        private readonly IServiceProvider _serviceProvider = serviceProvider;
        private readonly ILeaseInstanceRepository _leaseInstanceRepository = leaseInstanceRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<TenantDocumentService> _logger = logger;
        private const string ContainerName = "tenant-documents";
        private const string SignedDocumentsContainerName = "signed-documents";
        private const string LeaseDocumentsContainerName = "lease-documents";

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<List<LoadTenantDocumentDto>>> AddTenantDocuments(
            long tenantId,
            List<IFormFile> files,
            string? description,
            ETenantDocumentType documentType,
            DateTime? expirationDate,
            bool isRequired,
            long? leaseId,
            bool isPrivate = false)
        {
            try
            {
                var response = new ServiceResponse<List<LoadTenantDocumentDto>>
                {
                    Data = []
                };

                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                foreach (var file in files)
                {
                    // Validate file before processing
                    var validation = FileValidationHelper.ValidateDocumentFile(file);
                    if (!validation.IsValid)
                    {
                        _logger.LogWarning("File validation failed for {FileName}: {Error}", file.FileName, validation.ErrorMessage);
                        return ServiceResponse<List<LoadTenantDocumentDto>>.CreateError(
                            $"File validation failed: {validation.ErrorMessage}",
                            $"The file '{file.FileName}' could not be uploaded. {validation.ErrorMessage}"
                        );
                    }

                    // Create a unique blob name (use validated extension)
                    var extension = Path.GetExtension(file.FileName);
                    var blobName = $"{Guid.NewGuid()}{extension}";
                    var blobClient = containerClient.GetBlobClient(blobName);

                    // Upload the file
                    using (var stream = file.OpenReadStream())
                    {
                        await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = file.ContentType });
                    }

                    var document = new AddTenantDocumentDto
                    {
                        TenantId = tenantId,
                        FileName = file.FileName,
                        Description = description,
                        DocumentType = documentType,
                        ExpirationDate = expirationDate,
                        IsRequired = isRequired,
                        LeaseId = leaseId,
                        IsPrivate = isPrivate,
                        BlobName = blobName,
                        BlobUrl = blobClient.Uri.ToString()
                    };

                    // Get organizationId from context
                    var organizationId = GetOrganizationIdFromContext();

                    // Save the document details to the database
                    var result = await _tenantDocumentRepository.AddTenantDocument(document, organizationId);

                    // Generate a read-only SAS URI valid for 1 hour
                    var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                    result.BlobUrl = sasUri;
                    response.Data.Add(result);
                }

                response.Message = $"Uploaded {files.Count} document(s) successfully";
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading tenant documents to Azure Blob Storage");
                return ServiceResponse<List<LoadTenantDocumentDto>>.CreateError("Error uploading documents", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadTenantDocumentDto>>> AddLeaseDocuments(
            long leaseId,
            List<IFormFile> files,
            string? description,
            ETenantDocumentType documentType,
            bool isPrivate = false)
        {
            try
            {
                var response = new ServiceResponse<List<LoadTenantDocumentDto>> { Data = [] };
                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                foreach (var file in files)
                {
                    var validation = FileValidationHelper.ValidateDocumentFile(file);
                    if (!validation.IsValid)
                    {
                        _logger.LogWarning("File validation failed for {FileName}: {Error}", file.FileName, validation.ErrorMessage);
                        return ServiceResponse<List<LoadTenantDocumentDto>>.CreateError(
                            $"File validation failed: {validation.ErrorMessage}",
                            $"The file '{file.FileName}' could not be uploaded. {validation.ErrorMessage}");
                    }

                    var extension = Path.GetExtension(file.FileName);
                    var blobName = $"{Guid.NewGuid()}{extension}";
                    var blobClient = containerClient.GetBlobClient(blobName);
                    using (var stream = file.OpenReadStream())
                    {
                        await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = file.ContentType });
                    }

                    var document = new AddTenantDocumentDto
                    {
                        TenantId = null,
                        LeaseId = leaseId,
                        FileName = file.FileName,
                        Description = description,
                        DocumentType = documentType,
                        IsPrivate = isPrivate,
                        BlobName = blobName,
                        BlobUrl = blobClient.Uri.ToString()
                    };

                    var organizationId = GetOrganizationIdFromContext();
                    var result = await _tenantDocumentRepository.AddTenantDocument(document, organizationId);
                    var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                    result.BlobUrl = sasUri;
                    response.Data.Add(result);
                }

                response.Message = $"Uploaded {files.Count} document(s) successfully";
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading lease documents to Azure Blob Storage");
                return ServiceResponse<List<LoadTenantDocumentDto>>.CreateError("Error uploading documents", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadTenantDocumentDto>> GetTenantDocumentById(long id)
        {
            try
            {
                var document = await _tenantDocumentRepository.GetTenantDocumentById(id);
                if (document == null)
                {
                    return ServiceResponse<LoadTenantDocumentDto>.CreateError("Document not found", null, null, 404);
                }

                // Generate fresh SAS URL
                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                var blobClient = containerClient.GetBlobClient(document.BlobName);
                var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                document.BlobUrl = sasUri;

                return new ServiceResponse<LoadTenantDocumentDto>
                {
                    Data = document,
                    Message = "Document retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenant document {DocumentId}", id);
                return ServiceResponse<LoadTenantDocumentDto>.CreateError("Error retrieving document", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadTenantDocumentDto>>> GetTenantDocumentsByTenantId(long tenantId)
        {
            try
            {
                var documents = await _tenantDocumentRepository.GetTenantDocumentsByTenantId(tenantId);

                // Tenant-facing documents should include any non-private document explicitly attached
                // to the tenant or to one of the tenant's leases. That includes uploaded lease
                // agreements, even if the lease was not sent through the e-signature workflow.
                var visibleDocuments = documents;

                // Generate fresh SAS URLs for visible documents
                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                foreach (var document in visibleDocuments)
                {
                    if (!string.IsNullOrEmpty(document.BlobName))
                    {
                        var blobClient = containerClient.GetBlobClient(document.BlobName);
                        var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                        document.BlobUrl = sasUri;
                    }
                }

                return new ServiceResponse<List<LoadTenantDocumentDto>>
                {
                    Data = visibleDocuments,
                    Message = $"Retrieved {visibleDocuments.Count} document(s)"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenant documents for tenant {TenantId}", tenantId);
                return ServiceResponse<List<LoadTenantDocumentDto>>.CreateError("Error retrieving documents", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadTenantDocumentDto>>> GetTenantDocumentsByLandlordId(long landlordId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadTenantDocumentDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var documents = await _tenantDocumentRepository.GetTenantDocumentsByOrganizationId(organizationId.Value);

                // Generate fresh SAS URLs
                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                foreach (var document in documents)
                {
                    var blobClient = containerClient.GetBlobClient(document.BlobName);
                    var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                    document.BlobUrl = sasUri;
                }

                return new ServiceResponse<List<LoadTenantDocumentDto>>
                {
                    Data = documents,
                    Message = $"Retrieved {documents.Count} document(s)"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenant documents for landlord {LandlordId}", landlordId);
                return ServiceResponse<List<LoadTenantDocumentDto>>.CreateError("Error retrieving documents", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadTenantDocumentDto>> GetLeaseAgreementByLeaseId(long leaseId)
        {
            try
            {
                // First, check if lease has been sent to tenant (lazy load to avoid circular dependency)
                var leaseService = _serviceProvider.GetRequiredService<ILeaseService>();
                var leaseResponse = await leaseService.GetLeaseById(leaseId);
                if (!leaseResponse.Success || leaseResponse.Data == null)
                {
                    return ServiceResponse<LoadTenantDocumentDto>.CreateError(
                        "Lease not found",
                        "No lease found for this ID.",
                        statusCode: 404
                    );
                }

                var lease = leaseResponse.Data;

                // Check if lease has been sent to tenant
                // Lease agreements should only be visible to tenants after the landlord sends them for signature
                // Landlords and Admins should always be able to see the agreement
                var user = _httpContextAccessor.HttpContext?.User;
                var isLandlordOrAdmin = user?.IsInRole("Landlord") == true || user?.IsInRole("Admin") == true;

                if (!isLandlordOrAdmin && lease.LeaseAgreement?.SignatureStatus == ESignatureStatus.NotSent)
                {
                    return ServiceResponse<LoadTenantDocumentDto>.CreateError(
                        "Lease agreement not available",
                        "The lease agreement has not been sent to you yet. Please wait for your landlord to send it for signature.",
                        statusCode: 403
                    );
                }

                // Check if lease has a signed document (prioritize signed version)
                if (!string.IsNullOrEmpty(lease.LeaseAgreement?.SignedDocumentBlobName))
                {
                    // Return signed document
                    var containerClient = _blobServiceClient.GetBlobContainerClient(SignedDocumentsContainerName);
                    var blobClient = containerClient.GetBlobClient(lease.LeaseAgreement.SignedDocumentBlobName);
                    var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));

                    // Create a LoadTenantDocumentDto from the signed document
                    var signedDocument = new LoadTenantDocumentDto
                    {
                        Id = 0, // No tenant document ID for signed document
                        TenantId = 0,
                        FileName = "Lease Agreement - Signed.pdf",
                        Description = "Signed Lease Agreement",
                        DocumentType = ETenantDocumentType.LeaseAgreement,
                        BlobName = lease.LeaseAgreement.SignedDocumentBlobName,
                        BlobUrl = sasUri,
                        CreatedAt = lease.LeaseAgreement.SignatureCompletedAt ?? DateTime.UtcNow
                    };

                    return new ServiceResponse<LoadTenantDocumentDto>
                    {
                        Data = signedDocument,
                        Message = "Signed lease agreement retrieved successfully"
                    };
                }

                // Fallback to tenant document if no signed document exists
                var document = await _tenantDocumentRepository.GetLeaseAgreementByLeaseId(leaseId);

                if (document == null)
                {
                    // Fallback: Check for LeaseDocument from finalized LeaseInstance
                    try
                    {
                        var instances = await _leaseInstanceRepository.GetLeaseInstancesByLeaseIdAsync(leaseId);
                        var finalizedInstance = instances
                            .Where(i => i.IsFinalized)
                            .OrderByDescending(i => i.FinalizedAt ?? i.GeneratedAt)
                            .FirstOrDefault();

                        if (finalizedInstance != null && finalizedInstance.Documents != null && finalizedInstance.Documents.Any())
                        {
                            // Get the PDF document (prefer PDF over DOCX)
                            var leaseDocument = finalizedInstance.Documents
                                .Where(d => d.DocumentType == "PDF")
                                .OrderByDescending(d => d.GeneratedAt)
                                .FirstOrDefault()
                                ?? finalizedInstance.Documents
                                    .OrderByDescending(d => d.GeneratedAt)
                                    .FirstOrDefault();

                            if (leaseDocument != null && !string.IsNullOrEmpty(leaseDocument.BlobName))
                            {
                                // Generate fresh SAS URL for the lease document
                                var leaseDocContainerClient = _blobServiceClient.GetBlobContainerClient(LeaseDocumentsContainerName);
                                var leaseDocBlobClient = leaseDocContainerClient.GetBlobClient(leaseDocument.BlobName);
                                var leaseDocSasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, leaseDocBlobClient, TimeSpan.FromHours(1));

                                // Create a LoadTenantDocumentDto from the LeaseDocument
                                var leaseDocDto = new LoadTenantDocumentDto
                                {
                                    Id = 0, // No tenant document ID for lease document
                                    TenantId = 0,
                                    FileName = $"Lease Agreement - {finalizedInstance.LeaseTemplate?.Name ?? "Generated"}.pdf",
                                    Description = "Lease Agreement (Generated from Lease Builder)",
                                    DocumentType = ETenantDocumentType.LeaseAgreement,
                                    BlobName = leaseDocument.BlobName,
                                    BlobUrl = leaseDocSasUri,
                                    CreatedAt = leaseDocument.GeneratedAt,
                                    LeaseId = leaseId
                                };

                                return new ServiceResponse<LoadTenantDocumentDto>
                                {
                                    Data = leaseDocDto,
                                    Message = "Lease agreement retrieved from lease instance successfully"
                                };
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error checking lease instances for lease {LeaseId}, falling back to error response", leaseId);
                    }

                    // Return success with null data instead of 404 - no agreement exists for this lease
                    return new ServiceResponse<LoadTenantDocumentDto>
                    {
                        Success = true,
                        Data = null,
                        Message = "No lease agreement document found for this lease."
                    };
                }

                // Generate fresh SAS URL
                var tenantDocContainerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                var tenantDocBlobClient = tenantDocContainerClient.GetBlobClient(document.BlobName);
                var tenantDocSasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, tenantDocBlobClient, TimeSpan.FromHours(1));
                document.BlobUrl = tenantDocSasUri;

                return new ServiceResponse<LoadTenantDocumentDto>
                {
                    Data = document,
                    Message = "Lease agreement retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease agreement for lease {LeaseId}", leaseId);
                return ServiceResponse<LoadTenantDocumentDto>.CreateError("Error retrieving lease agreement", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadTenantDocumentDto>>> GetTenantDocumentsByLeaseId(long leaseId)
        {
            try
            {
                var documents = await _tenantDocumentRepository.GetTenantDocumentsByLeaseId(leaseId);

                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                foreach (var document in documents)
                {
                    if (!string.IsNullOrEmpty(document.BlobName))
                    {
                        var blobClient = containerClient.GetBlobClient(document.BlobName);
                        var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                        document.BlobUrl = sasUri;
                    }
                }

                return new ServiceResponse<List<LoadTenantDocumentDto>>
                {
                    Data = documents,
                    Message = $"Retrieved {documents.Count} document(s)"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving documents for lease {LeaseId}", leaseId);
                return ServiceResponse<List<LoadTenantDocumentDto>>.CreateError("Error retrieving documents", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadTenantDocumentDto>>> GetExpiringDocuments(long landlordId, int daysAhead = 30)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadTenantDocumentDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var documents = await _tenantDocumentRepository.GetExpiringDocumentsByOrganizationId(organizationId.Value, daysAhead);

                // Generate fresh SAS URLs
                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                foreach (var document in documents)
                {
                    var blobClient = containerClient.GetBlobClient(document.BlobName);
                    var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                    document.BlobUrl = sasUri;
                }

                return new ServiceResponse<List<LoadTenantDocumentDto>>
                {
                    Data = documents,
                    Message = $"Found {documents.Count} document(s) expiring within {daysAhead} days"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expiring documents for landlord {LandlordId}", landlordId);
                return ServiceResponse<List<LoadTenantDocumentDto>>.CreateError("Error retrieving expiring documents", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadTenantDocumentDto>> UpdateTenantDocument(UpdateTenantDocumentDto document)
        {
            try
            {
                var result = await _tenantDocumentRepository.UpdateTenantDocument(document);

                // Generate fresh SAS URL
                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                var blobClient = containerClient.GetBlobClient(result.BlobName);
                var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                result.BlobUrl = sasUri;

                return new ServiceResponse<LoadTenantDocumentDto>
                {
                    Data = result,
                    Message = "Document updated successfully"
                };
            }
            catch (KeyNotFoundException ex)
            {
                _logger.LogWarning(ex, "Document not found for update");
                return ServiceResponse<LoadTenantDocumentDto>.CreateError("Document not found", null, null, 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating tenant document {DocumentId}", document.Id);
                return ServiceResponse<LoadTenantDocumentDto>.CreateError("Error updating document", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteTenantDocument(long id)
        {
            try
            {
                var document = await _tenantDocumentRepository.GetTenantDocumentById(id);
                if (document == null)
                {
                    return ServiceResponse<bool>.CreateError("Document not found", null, null, 404);
                }

                // Soft delete from database
                var deleted = await _tenantDocumentRepository.DeleteTenantDocument(id);
                if (!deleted)
                {
                    return ServiceResponse<bool>.CreateError("Failed to delete document", null, null, 500);
                }

                // Optionally delete from blob storage (or keep for audit)
                // var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                // var blobClient = containerClient.GetBlobClient(document.BlobName);
                // await blobClient.DeleteIfExistsAsync();

                return new ServiceResponse<bool>
                {
                    Data = true,
                    Message = "Document deleted successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting tenant document {DocumentId}", id);
                return ServiceResponse<bool>.CreateError("Error deleting document", ex.Message);
            }
        }
    }
}

