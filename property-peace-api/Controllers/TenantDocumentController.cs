using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.TenantDocumentService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class TenantDocumentController(ITenantDocumentService tenantDocumentService) : ControllerBase
    {
        private readonly ITenantDocumentService _tenantDocumentService = tenantDocumentService;

        [HttpPost("upload")]
        public async Task<IActionResult> UploadDocuments(
            [FromForm] long tenantId,
            [FromForm] List<IFormFile> files,
            [FromForm] string? description = null,
            [FromForm] ETenantDocumentType documentType = ETenantDocumentType.Other,
            [FromForm] DateTime? expirationDate = null,
            [FromForm] bool isRequired = false,
            [FromForm] long? leaseId = null,
            [FromForm] bool isPrivate = false)
        {
            if (files == null || files.Count == 0)
            {
                return BadRequest(new { message = "No files provided" });
            }

            var response = await _tenantDocumentService.AddTenantDocuments(
                tenantId, files, description, documentType, expirationDate, isRequired, leaseId, isPrivate);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("upload-lease-document")]
        public async Task<IActionResult> UploadLeaseDocument(
            [FromForm] long leaseId,
            [FromForm] List<IFormFile> files,
            [FromForm] string? description = null,
            [FromForm] ETenantDocumentType documentType = ETenantDocumentType.Other,
            [FromForm] bool isPrivate = false)
        {
            if (files == null || files.Count == 0)
            {
                return BadRequest(new { message = "No files provided" });
            }

            var response = await _tenantDocumentService.AddLeaseDocuments(
                leaseId, files, description, documentType, isPrivate);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetDocument(long id)
        {
            var response = await _tenantDocumentService.GetTenantDocumentById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("tenant/{tenantId}")]
        public async Task<IActionResult> GetDocumentsByTenant(long tenantId)
        {
            var response = await _tenantDocumentService.GetTenantDocumentsByTenantId(tenantId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("landlord/{landlordId}")]
        public async Task<IActionResult> GetDocumentsByLandlord(long landlordId)
        {
            var response = await _tenantDocumentService.GetTenantDocumentsByLandlordId(landlordId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("lease/{leaseId}/agreement")]
        public async Task<IActionResult> GetLeaseAgreement(long leaseId)
        {
            var response = await _tenantDocumentService.GetLeaseAgreementByLeaseId(leaseId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("lease/{leaseId}/documents")]
        public async Task<IActionResult> GetDocumentsByLease(long leaseId)
        {
            var response = await _tenantDocumentService.GetTenantDocumentsByLeaseId(leaseId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("landlord/{landlordId}/expiring")]
        public async Task<IActionResult> GetExpiringDocuments(long landlordId, [FromQuery] int daysAhead = 30)
        {
            var response = await _tenantDocumentService.GetExpiringDocuments(landlordId, daysAhead);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDocument(long id, [FromBody] Dtos.TenantDocument.UpdateTenantDocumentDto document)
        {
            document.Id = id; // Ensure ID matches route
            var response = await _tenantDocumentService.UpdateTenantDocument(document);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocument(long id)
        {
            var response = await _tenantDocumentService.DeleteTenantDocument(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}

