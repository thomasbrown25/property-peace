using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class PropertyImageController(
        IImageService<PropertyImage, LoadImageDto, AddImageDto> imageService) : ControllerBase
    {
        private readonly IImageService<PropertyImage, LoadImageDto, AddImageDto> _imageService = imageService;

        [Authorize]
        [HttpPost("{propertyId}")]
        public async Task<IActionResult> AddPropertyImages(long propertyId, List<IFormFile> files)
        {
            // Use ImageService for uploads (same pattern as maintenance images and expense receipts)
            var response = await _imageService.AddImages(propertyId, files);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            // Map LoadImageDto to PropertyImage format for frontend compatibility
            // Return lowercase property names to match frontend expectations
            var mappedData = response.Data?.Select(r => new
            {
                Id = r.Id,
                PropertyId = r.RefId,
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
        [HttpGet("{propertyId}")]
        public async Task<IActionResult> GetPropertyImages(long propertyId)
        {
            // Use ImageService for retrieval (generates fresh SAS URLs)
            var response = await _imageService.GetImagesByRefId(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            // Map LoadImageDto to PropertyImage format for frontend compatibility
            var mappedData = response.Data?.Select(r => new
            {
                Id = r.Id,
                PropertyId = r.RefId,
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
        public async Task<IActionResult> DeletePropertyImage(long id)
        {
            // Use ImageService for deletion by ID
            var response = await _imageService.DeleteImageById(id);

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

