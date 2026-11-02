using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Models;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class ListingImageController(
        IImageService<ListingImage, LoadImageDto, AddImageDto> imageService,
        DataContext context) : ControllerBase
    {
        private readonly IImageService<ListingImage, LoadImageDto, AddImageDto> _imageService = imageService;

        [Authorize]
        [HttpPost("{listingId}")]
        public async Task<IActionResult> AddListingImages(long listingId, [FromForm] List<IFormFile>? files)
        {
            var fileList = files ?? new List<IFormFile>();
            var response = await _imageService.AddImages(listingId, fileList);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            var mappedData = response.Data?.Select(r => new
            {
                Id = r.Id,
                ListingId = r.RefId,
                BlobName = r.BlobName,
                BlobUrl = r.BlobUrl,
                CreatedAt = r.CreatedAt,
                IsCoverPhoto = (r as LoadImageDto)?.IsCoverPhoto ?? false,
                DisplayOrder = (r as LoadImageDto)?.DisplayOrder ?? 0
            }).ToList();

            return Ok(new
            {
                success = response.Success,
                message = response.Message,
                data = mappedData
            });
        }

        [Authorize]
        [HttpGet("{listingId}")]
        public async Task<IActionResult> GetListingImages(long listingId)
        {
            var response = await _imageService.GetImagesByRefId(listingId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            var mappedData = response.Data?.Select(r => new
            {
                Id = r.Id,
                ListingId = r.RefId,
                BlobName = r.BlobName,
                BlobUrl = r.BlobUrl,
                CreatedAt = r.CreatedAt,
                IsCoverPhoto = (r as LoadImageDto)?.IsCoverPhoto ?? false,
                DisplayOrder = (r as LoadImageDto)?.DisplayOrder ?? 0
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
        public async Task<IActionResult> DeleteListingImage(long id)
        {
            var response = await _imageService.DeleteImageById(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize]
        [HttpPut("{id}/set-cover")]
        public async Task<IActionResult> SetCoverPhoto(long id, [FromQuery] long listingId)
        {
            var response = await _imageService.SetCoverPhoto(listingId, id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(new { success = true, message = response.Message });
        }

        public sealed record ImageOrderRequest(List<long> ImageIds);

        [HttpPut("{listingId}/order")]
        public async Task<IActionResult> Reorder(long listingId, [FromBody] ImageOrderRequest request, CancellationToken ct)
        {
            if (!HttpContext.Items.TryGetValue("OrganizationId", out var value) || value is not long organizationId || organizationId <= 0)
                return Forbid();
            if (!await context.Set<Listing>().AnyAsync(l => l.Id == listingId && l.OrganizationId == organizationId, ct))
                return NotFound();

            var images = await context.Set<ListingImage>().Where(i => i.RefId == listingId).ToListAsync(ct);
            var ids = request?.ImageIds;
            if (ids == null || ids.Count != images.Count || ids.Distinct().Count() != images.Count ||
                !ids.ToHashSet().SetEquals(images.Select(i => i.Id)))
                return BadRequest(new { message = "Image order must contain every listing photo exactly once." });

            for (var index = 0; index < ids.Count; index++)
            {
                var image = images.Single(i => i.Id == ids[index]);
                image.DisplayOrder = index;
                image.IsCoverPhoto = index == 0;
            }
            await context.SaveChangesAsync(ct);
            return Ok(new { success = true });
        }
    }
}
