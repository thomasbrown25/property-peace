using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using brownstone_hub_api.Data;
using brownstone_hub_api.Services.AzureBlobService;
using Microsoft.EntityFrameworkCore;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Services.TenantService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class TenantController(ITenantService tenantService, DataContext dataContext, BlobServiceClient blobServiceClient, IAzureBlobService azureBlobService) : ControllerBase
    {
        private readonly ITenantService _tenantService = tenantService;

        [HttpPost("{id}/photo")]
        [RequestSizeLimit(5 * 1024 * 1024 + 65536)]
        public async Task<IActionResult> UploadTenantPhoto(long id, [FromForm] IFormFile file)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue) return Forbid();
            var tenant = await dataContext.Tenants.FirstOrDefaultAsync(t =>
                            t.Id == id && t.OrganizationId == organizationId.Value && !t.IsDeleted);
            if (tenant == null) return NotFound();
            if (file == null || file.Length == 0 || file.Length > 5 * 1024 * 1024)
                return BadRequest(new { Message = "Choose an image smaller than 5 MB." });
            var types = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["image/jpeg"] = ".jpg", ["image/png"] = ".png", ["image/webp"] = ".webp"
            };
            if (!types.TryGetValue(file.ContentType, out var extension))
                return BadRequest(new { Message = "Choose a JPEG, PNG, or WebP image." });
            await using var stream = file.OpenReadStream();
            var signature = new byte[12];
            var bytesRead = await stream.ReadAsync(signature);
            var valid = file.ContentType switch
            {
                "image/jpeg" => bytesRead >= 3 && signature[0] == 0xff && signature[1] == 0xd8 && signature[2] == 0xff,
                "image/png" => bytesRead >= 8 && signature.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
                "image/webp" => bytesRead >= 12 && System.Text.Encoding.ASCII.GetString(signature, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(signature, 8, 4) == "WEBP",
                _ => false
            };
            if (!valid) return BadRequest(new { Message = "The selected file is not a valid image." });
            stream.Position = 0;
            var container = blobServiceClient.GetBlobContainerClient("tenant-profile-images");
            await container.CreateIfNotExistsAsync(PublicAccessType.None);
            var blob = container.GetBlobClient($"{organizationId.Value}/{id}/{Guid.NewGuid()}{extension}");
            await blob.UploadAsync(stream, new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = file.ContentType } });
            var imageUrl = azureBlobService.GenerateBlobSasUri(blobServiceClient, blob, TimeSpan.FromDays(365));
            tenant.ProfileImageUrl = imageUrl;
            try { await dataContext.SaveChangesAsync(); }
            catch { await blob.DeleteIfExistsAsync(); throw; }
            return Ok(new { ImageUrl = imageUrl });
        }


        [Authorize]
        [HttpPost("")]
        public async Task<IActionResult> AddOrUpdateTenant([FromBody] AddTenantDto tenant)
        {
            var response = await _tenantService.AddOrUpdateTenant(tenant);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("lease/{leaseId}")]
        public async Task<IActionResult> GetTenantsByLeaseId(long leaseId)
        {
            var response = await _tenantService.GetTenantsByLeaseId(leaseId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetTenantById(long id)
        {
            var response = await _tenantService.GetTenantById(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("organization")]
        public async Task<IActionResult> GetAllTenantsByOrganizationId()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _tenantService.GetAllTenantsByOrganizationId(organizationId.Value);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTenant(long id)
        {
            var response = await _tenantService.DeleteTenant(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpGet("check-email/{email}")]
        public async Task<IActionResult> CheckEmailExists(string email)
        {
            var response = await _tenantService.CheckEmailExists(email);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpPost("get-by-email")]
        public async Task<IActionResult> GetTenantByEmail([FromBody] CheckEmailDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { Message = "Email is required" });
            }

            var response = await _tenantService.GetTenantByEmail(request.Email);

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