using brownstone_hub_api.Services.ExpenseReceiptService;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Dtos.Image;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class ExpenseReceiptController(
        IExpenseReceiptService expenseReceiptService,
        IImageService<ExpenseReceipt, LoadImageDto, AddImageDto> imageService) : ControllerBase
    {
        private readonly IExpenseReceiptService _expenseReceiptService = expenseReceiptService;
        private readonly IImageService<ExpenseReceipt, LoadImageDto, AddImageDto> _imageService = imageService;

        [Authorize]
        [HttpPost("{expenseId}")]
        public async Task<IActionResult> AddExpenseReceipts(long expenseId, List<IFormFile> files)
        {
            // Use ImageService for uploads (same pattern as property images)
            var response = await _imageService.AddImages(expenseId, files);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            // Map LoadImageDto to LoadExpenseReceiptDto format for frontend compatibility
            // Return lowercase property names to match frontend expectations
            var mappedData = response.Data?.Select(r => new
            {
                Id = r.Id,
                ExpenseId = r.RefId,
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
        [HttpGet("{expenseId}")]
        public async Task<IActionResult> GetExpenseReceipts(long expenseId)
        {
            // Use ImageService for retrieval (same pattern as property images) - generates fresh SAS URLs
            var response = await _imageService.GetImagesByRefId(expenseId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            // Map LoadImageDto to LoadExpenseReceiptDto format for frontend compatibility
            // Return lowercase property names to match frontend expectations
            var mappedData = response.Data?.Select(r => new
            {
                Id = r.Id,
                ExpenseId = r.RefId,
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
        public async Task<IActionResult> DeleteExpenseReceipt(long id)
        {
            // Use ExpenseReceiptService for deletion (handles ID lookup and blob deletion)
            var response = await _expenseReceiptService.DeleteExpenseReceipt(id);

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

