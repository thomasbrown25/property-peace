using brownstone_hub_api.Services.MaintenanceImageService;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Tenant,Landlord,Admin")]
    public class MaintenanceImageController(
        IMaintenanceImageService maintenanceImageService,
        IImageService<MaintenanceImage, LoadImageDto, AddImageDto> imageService) : ControllerBase
    {
        private readonly IMaintenanceImageService _maintenanceImageService = maintenanceImageService;
        private readonly IImageService<MaintenanceImage, LoadImageDto, AddImageDto> _imageService = imageService;

        [Authorize]
        [HttpPost("{maintenanceRequestId}")]
        public async Task<IActionResult> AddMaintenanceImages(long maintenanceRequestId, List<IFormFile> files)
        {
            // Use ImageService for uploads (same pattern as expense receipts and property images)
            var response = await _imageService.AddImages(maintenanceRequestId, files);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            // Map LoadImageDto to LoadMaintenanceImageDto format for frontend compatibility
            // Return lowercase property names to match frontend expectations
            var mappedData = response.Data?.Select(r => new
            {
                Id = r.Id,
                MaintenanceRequestId = r.RefId,
                BlobName = r.BlobName,
                BlobUrl = r.BlobUrl,
                CreatedAt = r.CreatedAt
            }).ToList();

            return Ok(new
            {
                success = response.Success,
                message = response.Message,
                data = mappedData
            });
        }

        [Authorize]
        [HttpGet("{maintenanceRequestId}")]
        public async Task<IActionResult> GetMaintenanceImages(long maintenanceRequestId)
        {
            // Use ImageService for retrieval (same pattern as expense receipts and property images) - generates fresh SAS URLs
            var response = await _imageService.GetImagesByRefId(maintenanceRequestId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            // Map LoadImageDto to LoadMaintenanceImageDto format for frontend compatibility
            // Return lowercase property names to match frontend expectations
            var mappedData = response.Data?.Select(r => new
            {
                Id = r.Id,
                MaintenanceRequestId = r.RefId,
                BlobName = r.BlobName,
                BlobUrl = r.BlobUrl,
                CreatedAt = r.CreatedAt
            }).ToList();

            return Ok(new
            {
                success = response.Success,
                message = response.Message,
                data = mappedData
            });
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMaintenanceImage(long id)
        {
            // Use MaintenanceImageService for deletion (handles ID lookup and blob deletion)
            var response = await _maintenanceImageService.DeleteMaintenanceImage(id);

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