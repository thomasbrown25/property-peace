using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Services.ListingService;
using brownstone_hub_api.Services.ListingAIService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ListingController(IListingService listingService, IListingAIService listingAIService) : ControllerBase
    {
        private readonly IListingService _listingService = listingService;
        private readonly IListingAIService _listingAIService = listingAIService;

        [HttpGet]
        public async Task<IActionResult> GetListings()
        {
            var response = await _listingService.GetListingsByOrganization();

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetListingById(long id)
        {
            var response = await _listingService.GetListingById(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpGet("public")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublicListings()
        {
            var response = await _listingService.GetPublicListingsAsync();

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpGet("public/{listingNumber}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublicListing(string listingNumber)
        {
            var response = await _listingService.GetPublicListing(listingNumber);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpGet("public/slug/{slug}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublicListingBySlug(string slug)
        {
            var response = await _listingService.GetPublicListingBySlug(slug);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(new { success = true, data = response.Data });
        }

        [HttpGet("property/{propertyId}")]
        public async Task<IActionResult> GetListingsByPropertyId(long propertyId)
        {
            var response = await _listingService.GetListingsByPropertyIdAsync(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpGet("unit/{unitId}/is-listed")]
        public async Task<IActionResult> IsUnitListed(long unitId)
        {
            var response = await _listingService.IsUnitListed(unitId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpPost]
        public async Task<IActionResult> CreateListing([FromForm] CreateListingDto listingDto, [FromForm] List<IFormFile>? files)
        {
            var response = await _listingService.CreateListing(listingDto, files);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateListing(long id, [FromBody] UpdateListingDto listingDto)
        {
            listingDto.Id = id;
            var response = await _listingService.UpdateListing(listingDto);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpPost("{id}/publish")]
        public async Task<IActionResult> PublishListing(long id)
        {
            var response = await _listingService.PublishListing(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteListing(long id)
        {
            var response = await _listingService.DeleteListing(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpPost("ai/generate-description")]
        public async Task<IActionResult> GenerateMarketingDescription([FromBody] GenerateDescriptionRequest request)
        {
            var response = await _listingAIService.GenerateMarketingDescription(
                request.PropertyName,
                request.PropertyAddress,
                request.UnitName,
                request.SquareFeet,
                request.YearBuilt,
                request.Bedrooms,
                request.Baths,
                request.MonthlyRent,
                request.BasicAmenities ?? new List<string>(),
                request.PropertyAmenities ?? new List<string>(),
                request.PropertyFeatures ?? new List<string>()
            );

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }
    }

    public class GenerateDescriptionRequest
    {
        public string PropertyName { get; set; } = "";
        public string PropertyAddress { get; set; } = "";
        public string? UnitName { get; set; }
        public int? SquareFeet { get; set; }
        public int? YearBuilt { get; set; }
        public string? Bedrooms { get; set; }
        public string? Baths { get; set; }
        public decimal MonthlyRent { get; set; }
        public List<string>? BasicAmenities { get; set; }
        public List<string>? PropertyAmenities { get; set; }
        public List<string>? PropertyFeatures { get; set; }
    }
}
