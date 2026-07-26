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
using brownstone_hub_api.Services.LeaseFinalizationLock;
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
        private readonly ILeaseFinalizationLock _distributedFinalizationLock;
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<(long OrganizationId, long LeaseId), SemaphoreSlim> FinalizationLocks = new();

        public LeaseGenerationController(
            ILeaseGenerationService leaseGenerationService,
            ILeaseDocumentService leaseDocumentService,
            IPolicyAIService policyAIService,
            ILeaseInstanceRepository leaseInstanceRepository,
            ILeaseRepository leaseRepository,
            ITenantDocumentRepository tenantDocumentRepository,
            BlobServiceClient blobServiceClient,
            ILeaseFinalizationLock distributedFinalizationLock,
            ILogger<LeaseGenerationController> logger)
        {
            _leaseGenerationService = leaseGenerationService;
            _leaseDocumentService = leaseDocumentService;
            _policyAIService = policyAIService;
            _leaseInstanceRepository = leaseInstanceRepository;
            _leaseRepository = leaseRepository;
            _tenantDocumentRepository = tenantDocumentRepository;
            _blobServiceClient = blobServiceClient;
            _distributedFinalizationLock = distributedFinalizationLock;
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
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Where(x => x.Value?.Errors.Count > 0)
                    .SelectMany(x => x.Value.Errors.Select(e => $"{x.Key}: {e.ErrorMessage}"))
                    .ToList();
                return BadRequest(new { Message = "Validation failed", Errors = errors });
            }

            var response = await _leaseGenerationService.CreateLeaseInstanceAsync(dto, organizationId.Value);
            
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
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var response = await _leaseGenerationService.GetLeaseInstanceByIdAsync(id, organizationId.Value);
            
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
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var response = await _leaseGenerationService.ResolvePlaceholdersAsync(id, organizationId.Value);
            
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
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var response = await _leaseGenerationService.ValidatePlaceholdersAsync(id, organizationId.Value);
            
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
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var response = await _leaseGenerationService.GetLeaseInstancesByLeaseIdAsync(leaseId, organizationId.Value);
            
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

            var gate = FinalizationLocks.GetOrAdd((organizationId.Value, leaseId), _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync(HttpContext.RequestAborted);
            try
            {
                await using var distributedLock = await _distributedFinalizationLock.AcquireAsync(
                    organizationId.Value, leaseId, HttpContext.RequestAborted);
                var response = await _leaseGenerationService.FinishLeaseAgreementAsync(leaseId, organizationId.Value);
                if (!response.Success)
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });

                var instanceId = response.Data?.Id ?? 0;
                if (instanceId == 0 || response.Data?.IsFinalized == true)
                    return Ok(response);

                var artifactFailure = await PublishArtifactsAsync(instanceId, organizationId.Value);
                if (artifactFailure != null)
                    return artifactFailure;

                var finalized = await _leaseGenerationService.FinalizeLeaseInstanceAsync(instanceId, organizationId.Value);
                if (!finalized.Success)
                    return StatusCode(finalized.StatusCode, new { finalized.Message, finalized.Errors });
                if (finalized.Data != null && finalized.Data.Id != instanceId)
                {
                    var canonicalArtifactFailure = await PublishArtifactsAsync(finalized.Data.Id, organizationId.Value);
                    if (canonicalArtifactFailure != null)
                        return canonicalArtifactFailure;
                }
                return Ok(finalized);
            }
            finally
            {
                gate.Release();
            }
        }

        [HttpPost("instance/{id}/finalize")]
        public async Task<IActionResult> FinalizeLeaseInstance(long id)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var initial = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(id, organizationId.Value);
            if (initial == null)
                return NotFound(new { Message = "Lease instance not found" });

            var gate = FinalizationLocks.GetOrAdd((organizationId.Value, initial.LeaseId), _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync(HttpContext.RequestAborted);
            try
            {
                await using var distributedLock = await _distributedFinalizationLock.AcquireAsync(
                    organizationId.Value, initial.LeaseId, HttpContext.RequestAborted);
                var prepared = await _leaseGenerationService.PrepareLeaseInstanceForFinalizationAsync(id, organizationId.Value);
                if (!prepared.Success)
                    return StatusCode(prepared.StatusCode, new { prepared.Message, prepared.Errors });
                if (prepared.Data?.IsFinalized == true)
                    return Ok(prepared);

                var artifactFailure = await PublishArtifactsAsync(id, organizationId.Value);
                if (artifactFailure != null)
                    return artifactFailure;

                var finalized = await _leaseGenerationService.FinalizeLeaseInstanceAsync(id, organizationId.Value);
                if (!finalized.Success)
                    return StatusCode(finalized.StatusCode, new { finalized.Message, finalized.Errors });
                if (finalized.Data != null && finalized.Data.Id != id)
                {
                    var canonicalArtifactFailure = await PublishArtifactsAsync(finalized.Data.Id, organizationId.Value);
                    if (canonicalArtifactFailure != null)
                        return canonicalArtifactFailure;
                }
                return Ok(finalized);
            }
            finally
            {
                gate.Release();
            }
        }

        private async Task<IActionResult?> PublishArtifactsAsync(long instanceId, long organizationId)
        {
            try
            {
                var pdfResponse = await _leaseDocumentService.GeneratePdfAsync(instanceId, organizationId);
                if (!pdfResponse.Success || pdfResponse.Data == null)
                    return StatusCode(pdfResponse.StatusCode, new { pdfResponse.Message, pdfResponse.Errors });

                var saveResponse = await _leaseDocumentService.SaveDocumentToBlobAsync(
                    pdfResponse.Data, $"lease-{instanceId}.pdf", instanceId, "PDF", organizationId);
                if (!saveResponse.Success || string.IsNullOrEmpty(saveResponse.Data))
                    return StatusCode(saveResponse.StatusCode, new { saveResponse.Message, saveResponse.Errors });

                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(instanceId, organizationId);
                if (instance == null)
                    return NotFound(new { Message = "Lease instance not found" });
                if (instance.Lease?.TenantLeases?.Any() == true)
                    await CreateTenantDocumentsFromLeaseInstance(instance, saveResponse.Data, pdfResponse.Data, organizationId);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Artifact publication failed for lease instance {InstanceId}", instanceId);
                return StatusCode(500, new { Message = "Lease artifacts could not be published; the lease remains non-finalized and may be retried." });
            }
        }

        private async Task CreateTenantDocumentsFromLeaseInstance(
            Models.LeaseInstance instance,
            string sourceBlobUrl,
            byte[] pdfBytes,
            long organizationId)
        {
            try
            {
                var lease = instance.Lease;
                if (lease == null || lease.TenantLeases == null || !lease.TenantLeases.Any())
                    return;

                // Copy PDF from lease-instances container to tenant-documents container
                var tenantDocumentsContainer = _blobServiceClient.GetBlobContainerClient("tenant-documents");
                await tenantDocumentsContainer.CreateIfNotExistsAsync();

                var fileName = $"lease-agreement-{lease.Id}.pdf";
                var blobName = $"lease-instances/{instance.Id}/lease-agreement.pdf";
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

                // Create TenantDocument for each tenant
                int documentsCreated = 0;
                foreach (var tenantLease in lease.TenantLeases)
                {
                    var tenant = tenantLease.Tenant;
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

                    var createdDoc = await _tenantDocumentRepository.UpsertLeaseAgreementAsync(documentDto, organizationId);
                    documentsCreated++;
                    _logger.LogInformation("Created tenant document {DocumentId} for tenant {TenantId} (LeaseId: {LeaseId}) from lease instance {InstanceId}",
                        createdDoc.Id, tenant.Id, lease.Id, instance.Id);
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
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var response = await _leaseDocumentService.GeneratePdfAsync(id, organizationId.Value);
            
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
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var response = await _leaseDocumentService.GenerateDocxAsync(id, organizationId.Value);
            
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
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var pdfResponse = await _leaseDocumentService.GeneratePdfAsync(id, organizationId.Value);
            
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
                "PDF",
                organizationId.Value);

            if (!saveResponse.Success)
                return StatusCode(saveResponse.StatusCode, new
                {
                    saveResponse.Message,
                    saveResponse.Errors
                });

            // If instance is finalized, also create tenant documents
            try
            {
                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(id, organizationId.Value);
                if (instance?.IsFinalized == true && pdfResponse.Data != null)
                {
                    await CreateTenantDocumentsFromLeaseInstance(instance, saveResponse.Data!, pdfResponse.Data, organizationId.Value);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tenant documents after PDF generation for instance {InstanceId}", id);
                return StatusCode(500, new { Message = "The PDF was saved, but tenant publication failed." });
            }

            return Ok(new { BlobUrl = saveResponse.Data });
        }

        [HttpPost("instance/{id}/generate-and-save-docx")]
        public async Task<IActionResult> GenerateAndSaveDocx(long id)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var docxResponse = await _leaseDocumentService.GenerateDocxAsync(id, organizationId.Value);
            
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
                "DOCX",
                organizationId.Value);

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
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var response = await _leaseDocumentService.GetDocumentsByInstanceAsync(id, organizationId.Value);
            
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
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var response = await _leaseGenerationService.ReviewLeaseInstanceAsync(id, organizationId.Value);

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
