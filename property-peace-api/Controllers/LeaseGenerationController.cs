using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.LeaseGeneration;
using brownstone_hub_api.Dtos.TenantDocument;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Services.LeaseGenerationService;
using brownstone_hub_api.Services.LeaseDocumentService;
using brownstone_hub_api.Services.PolicyAIService;
using brownstone_hub_api.Repositories.LeaseInstances;
using brownstone_hub_api.Repositories.TenantDocuments;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class LeaseGenerationController : ControllerBase
    {
        private readonly ILeaseGenerationService _leaseGenerationService;
        private readonly ILeaseDocumentService _leaseDocumentService;
        private readonly IPolicyAIService _policyAIService;
        private readonly ILeaseInstanceRepository _leaseInstanceRepository;
        private readonly ILeaseRepository _leaseRepository;
        private readonly ITenantDocumentRepository _tenantDocumentRepository;
        private readonly BlobServiceClient _blobServiceClient;
        private readonly ILogger<LeaseGenerationController> _logger;

        public LeaseGenerationController(
            ILeaseGenerationService leaseGenerationService,
            ILeaseDocumentService leaseDocumentService,
            IPolicyAIService policyAIService,
            ILeaseInstanceRepository leaseInstanceRepository,
            ILeaseRepository leaseRepository,
            ITenantDocumentRepository tenantDocumentRepository,
            BlobServiceClient blobServiceClient,
            ILogger<LeaseGenerationController> logger)
        {
            _leaseGenerationService = leaseGenerationService;
            _leaseDocumentService = leaseDocumentService;
            _policyAIService = policyAIService;
            _leaseInstanceRepository = leaseInstanceRepository;
            _leaseRepository = leaseRepository;
            _tenantDocumentRepository = tenantDocumentRepository;
            _blobServiceClient = blobServiceClient;
            _logger = logger;
        }

        [HttpGet("placeholders")]
        public async Task<IActionResult> GetPlaceholderCatalog()
        {
            var response = await _leaseGenerationService.GetPlaceholderCatalogAsync();
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPost("instance")]
        public async Task<IActionResult> CreateLeaseInstance([FromBody] CreateLeaseInstanceDto dto)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Where(x => x.Value?.Errors.Count > 0)
                    .SelectMany(x => x.Value.Errors.Select(e => $"{x.Key}: {e.ErrorMessage}"))
                    .ToList();
                return BadRequest(new { Message = "Validation failed", Errors = errors });
            }

            var response = await _leaseGenerationService.CreateLeaseInstanceAsync(dto);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return CreatedAtAction(nameof(GetLeaseInstance), new { id = response.Data?.Id }, response);
        }

        [HttpGet("instance/{id}")]
        public async Task<IActionResult> GetLeaseInstance(long id)
        {
            var response = await _leaseGenerationService.GetLeaseInstanceByIdAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPost("instance/{id}/resolve")]
        public async Task<IActionResult> ResolvePlaceholders(long id)
        {
            var response = await _leaseGenerationService.ResolvePlaceholdersAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet("instance/{id}/validate")]
        public async Task<IActionResult> ValidatePlaceholders(long id)
        {
            var response = await _leaseGenerationService.ValidatePlaceholdersAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpGet("lease/{leaseId}/instances")]
        public async Task<IActionResult> GetLeaseInstancesByLeaseId(long leaseId)
        {
            var response = await _leaseGenerationService.GetLeaseInstancesByLeaseIdAsync(leaseId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        /// <summary>Finish the lease agreement: create instance from current lease data, finalize it, generate and save PDF, create tenant documents.</summary>
        [HttpPost("lease/{leaseId}/finish")]
        public async Task<IActionResult> FinishLeaseAgreement(long leaseId)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _leaseGenerationService.FinishLeaseAgreementAsync(leaseId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            var instanceId = response.Data?.Id ?? 0;
            if (instanceId == 0)
                return Ok(response);

            // Generate and save PDF and create tenant documents (same as after finalize)
            try
            {
                var pdfResponse = await _leaseDocumentService.GeneratePdfAsync(instanceId);
                if (pdfResponse.Success && pdfResponse.Data != null)
                {
                    var saveResponse = await _leaseDocumentService.SaveDocumentToBlobAsync(
                        pdfResponse.Data!,
                        $"lease-{instanceId}.pdf",
                        instanceId,
                        "PDF");

                    if (saveResponse.Success && !string.IsNullOrEmpty(saveResponse.Data))
                    {
                        var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(instanceId, null);
                        if (instance?.Lease != null && instance.Lease.TenantLeases != null && instance.Lease.TenantLeases.Any())
                        {
                            _logger.LogInformation("Creating tenant documents for {TenantCount} tenants on lease {LeaseId}",
                                instance.Lease.TenantLeases.Count, instance.Lease.Id);
                            await CreateTenantDocumentsFromLeaseInstance(instance, saveResponse.Data, pdfResponse.Data!);
                            _logger.LogInformation("Successfully created tenant documents for lease {LeaseId}", instance.Lease.Id);
                        }
                        else if (instance?.Lease != null)
                        {
                            _logger.LogWarning("Skipping tenant document creation for lease {LeaseId} - no tenants found.", instance.Lease.Id);
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Failed to save PDF for lease instance {InstanceId}: {Message}", instanceId, saveResponse.Message);
                    }
                }
                else
                {
                    _logger.LogWarning("Failed to generate PDF for lease instance {InstanceId}: {Message}", instanceId, pdfResponse.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tenant documents after finish for instance {InstanceId}", instanceId);
            }

            return Ok(response);
        }

        [HttpPost("instance/{id}/finalize")]
        public async Task<IActionResult> FinalizeLeaseInstance(long id)
        {
            var response = await _leaseGenerationService.FinalizeLeaseInstanceAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            // After finalization, generate PDF and save as tenant documents
            try
            {
                // Generate and save PDF
                var pdfResponse = await _leaseDocumentService.GeneratePdfAsync(id);
                if (pdfResponse.Success && pdfResponse.Data != null)
                {
                    var saveResponse = await _leaseDocumentService.SaveDocumentToBlobAsync(
                        pdfResponse.Data!,
                        $"lease-{id}.pdf",
                        id,
                        "PDF");

                    if (saveResponse.Success && !string.IsNullOrEmpty(saveResponse.Data))
                    {
                        // Get the lease instance to access lease and tenants
                        // Pass null for organizationId to get it from the lease
                        var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(id, null);
                        
                        if (instance?.Lease != null)
                        {
                            // Check if lease has tenants
                            if (instance.Lease.TenantLeases != null && instance.Lease.TenantLeases.Any())
                            {
                                _logger.LogInformation("Creating tenant documents for {TenantCount} tenants on lease {LeaseId}", 
                                    instance.Lease.TenantLeases.Count, instance.Lease.Id);
                                
                                // Copy PDF to tenant-documents container and create TenantDocument records
                                await CreateTenantDocumentsFromLeaseInstance(instance, saveResponse.Data, pdfResponse.Data!);
                                
                                _logger.LogInformation("Successfully created tenant documents for lease {LeaseId}", instance.Lease.Id);
                            }
                            else
                            {
                                _logger.LogWarning("Lease {LeaseId} has no tenants linked. Attempting to find and link tenants from instance variables.", instance.Lease.Id);
                                
                                // Try to find tenants from the instance variables (tenant names were resolved during creation)
                                // This is a fallback - ideally tenants should be linked during instance creation
                                var tenantVariables = instance.Variables?.Where(v => v.VariableKey.StartsWith("Tenant.")).ToList();
                                if (tenantVariables != null && tenantVariables.Any())
                                {
                                    _logger.LogInformation("Found tenant variables in instance, but cannot automatically link without tenant IDs. Please ensure tenants are added to the lease before finalizing.");
                                }
                                
                                _logger.LogWarning("Skipping tenant document creation for lease {LeaseId} - no tenants found. Documents can be manually uploaded later.", instance.Lease.Id);
                            }
                        }
                        else
                        {
                            _logger.LogWarning("Lease instance {InstanceId} has no associated lease", id);
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Failed to save PDF for lease instance {InstanceId}: {Message}", 
                            id, saveResponse.Message);
                    }
                }
                else
                {
                    _logger.LogWarning("Failed to generate PDF for lease instance {InstanceId}: {Message}", 
                        id, pdfResponse.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tenant documents after finalization for instance {InstanceId}", id);
                // Don't fail the finalization if document creation fails, but log the error
            }

            return Ok(response);
        }

        private async Task CreateTenantDocumentsFromLeaseInstance(
            Models.LeaseInstance instance,
            string sourceBlobUrl,
            byte[] pdfBytes)
        {
            try
            {
                var lease = instance.Lease;
                if (lease == null || lease.TenantLeases == null || !lease.TenantLeases.Any())
                    return;

                // Copy PDF from lease-instances container to tenant-documents container
                var tenantDocumentsContainer = _blobServiceClient.GetBlobContainerClient("tenant-documents");
                await tenantDocumentsContainer.CreateIfNotExistsAsync();

                var fileName = $"lease-agreement-{lease.Id}-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";
                var blobName = $"{Guid.NewGuid()}.pdf";
                var blobClient = tenantDocumentsContainer.GetBlobClient(blobName);

                // Upload the PDF bytes to tenant-documents container
                using (var stream = new MemoryStream(pdfBytes))
                {
                    await blobClient.UploadAsync(stream, overwrite: true);
                    await blobClient.SetHttpHeadersAsync(new Azure.Storage.Blobs.Models.BlobHttpHeaders 
                    { 
                        ContentType = "application/pdf" 
                    });
                }

                var blobUrl = blobClient.Uri.ToString();

                // Get organization ID from lease
                var organizationId = lease.Unit?.Property?.OrganizationId;

                // Create TenantDocument for each tenant
                int documentsCreated = 0;
                foreach (var tenantLease in lease.TenantLeases)
                {
                    var tenant = tenantLease.Tenant;
                    try
                    {
                        var documentDto = new AddTenantDocumentDto
                        {
                            TenantId = tenant.Id,
                            FileName = fileName,
                            Description = "Lease Agreement (Generated from Lease Builder)",
                            DocumentType = ETenantDocumentType.LeaseAgreement,
                            ExpirationDate = null,
                            IsRequired = false,
                            LeaseId = lease.Id,
                            BlobName = blobName,
                            BlobUrl = blobUrl
                        };

                        // Use repository directly to create the document
                        var createdDoc = await _tenantDocumentRepository.AddTenantDocument(documentDto, organizationId);
                        documentsCreated++;
                        _logger.LogInformation("Created tenant document {DocumentId} for tenant {TenantId} (LeaseId: {LeaseId}) from lease instance {InstanceId}", 
                            createdDoc.Id, tenant.Id, lease.Id, instance.Id);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error creating tenant document for tenant {TenantId} on lease {LeaseId}: {Message}", 
                            tenant.Id, lease.Id, ex.Message);
                    }
                }
                
                _logger.LogInformation("Successfully created {Count} tenant document(s) for lease {LeaseId}", documentsCreated, lease.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tenant documents from lease instance {InstanceId}", instance.Id);
                throw;
            }
        }

        [HttpPost("lease/{leaseId}/preview-pdf")]
        public async Task<IActionResult> GenerateLeasePreviewPdf(long leaseId)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId.Value);
            if (lease == null)
                return NotFound(new { Message = "Lease not found" });

            var response = await _leaseDocumentService.GeneratePreviewPdfFromLeaseAsync(lease);
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return File(response.Data!, "application/pdf", $"lease-preview-{leaseId}.pdf");
        }

        [HttpPost("instance/{id}/generate-pdf")]
        public async Task<IActionResult> GeneratePdf(long id)
        {
            var response = await _leaseDocumentService.GeneratePdfAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return File(response.Data!, "application/pdf", $"lease-{id}.pdf");
        }

        [HttpPost("instance/{id}/generate-docx")]
        public async Task<IActionResult> GenerateDocx(long id)
        {
            var response = await _leaseDocumentService.GenerateDocxAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return File(response.Data!, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", $"lease-{id}.docx");
        }

        [HttpPost("instance/{id}/generate-and-save-pdf")]
        public async Task<IActionResult> GenerateAndSavePdf(long id)
        {
            var pdfResponse = await _leaseDocumentService.GeneratePdfAsync(id);
            
            if (!pdfResponse.Success)
                return StatusCode(pdfResponse.StatusCode, new
                {
                    pdfResponse.Message,
                    pdfResponse.Errors
                });

            var saveResponse = await _leaseDocumentService.SaveDocumentToBlobAsync(
                pdfResponse.Data!, 
                $"lease-{id}.pdf", 
                id, 
                "PDF");

            if (!saveResponse.Success)
                return StatusCode(saveResponse.StatusCode, new
                {
                    saveResponse.Message,
                    saveResponse.Errors
                });

            // If instance is finalized, also create tenant documents
            try
            {
                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(id);
                if (instance?.IsFinalized == true && pdfResponse.Data != null)
                {
                    await CreateTenantDocumentsFromLeaseInstance(instance, saveResponse.Data, pdfResponse.Data);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tenant documents after PDF generation for instance {InstanceId}", id);
                // Don't fail the request if tenant document creation fails
            }

            return Ok(new { BlobUrl = saveResponse.Data });
        }

        [HttpPost("instance/{id}/generate-and-save-docx")]
        public async Task<IActionResult> GenerateAndSaveDocx(long id)
        {
            var docxResponse = await _leaseDocumentService.GenerateDocxAsync(id);
            
            if (!docxResponse.Success)
                return StatusCode(docxResponse.StatusCode, new
                {
                    docxResponse.Message,
                    docxResponse.Errors
                });

            var saveResponse = await _leaseDocumentService.SaveDocumentToBlobAsync(
                docxResponse.Data!, 
                $"lease-{id}.docx", 
                id, 
                "DOCX");

            if (!saveResponse.Success)
                return StatusCode(saveResponse.StatusCode, new
                {
                    saveResponse.Message,
                    saveResponse.Errors
                });

            return Ok(new { BlobUrl = saveResponse.Data });
        }

        [HttpGet("instance/{id}/documents")]
        public async Task<IActionResult> GetDocuments(long id)
        {
            var response = await _leaseDocumentService.GetDocumentsByInstanceAsync(id);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        /// <summary>Uses AI to review a lease instance and return flagged issues (missing clauses, risky terms, state compliance).</summary>
        [HttpPost("instance/{id}/review")]
        public async Task<IActionResult> ReviewLeaseInstance(long id)
        {
            var response = await _leaseGenerationService.ReviewLeaseInstanceAsync(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPost("policies/format")]
        public async Task<IActionResult> FormatPolicies([FromBody] FormatPoliciesDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var response = await _policyAIService.FormatPoliciesAsync(dto);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPost("policies/suggest")]
        public async Task<IActionResult> SuggestPolicies([FromBody] SuggestPoliciesDto dto)
        {
            if (dto == null)
            {
                dto = new SuggestPoliciesDto { Tone = "Neutral" };
            }

            var response = await _policyAIService.SuggestPoliciesAsync(dto);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [HttpPost("policies/normalize")]
        public async Task<IActionResult> NormalizePolicies([FromBody] List<string> policies)
        {
            if (policies == null)
                return BadRequest(new { Message = "Policies list is required" });

            var response = await _policyAIService.NormalizePoliciesAsync(policies);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }
    }
}
