using System.Security.Claims;
using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.ListingService;
using brownstone_hub_api.Services.ListingAIService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ListingController(
        IListingService listingService,
        IListingAIService listingAIService,
        IFeatureReadinessService featureReadinessService) : ControllerBase
    {
        private readonly IListingService _listingService = listingService;
        private readonly IListingAIService _listingAIService = listingAIService;
        private readonly IFeatureReadinessService _featureReadinessService = featureReadinessService;

        [HttpGet]
        public async Task<IActionResult> GetListings()
        {
            var response = await _listingService.GetListingsByOrganization();

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpGet("{id}")]
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
            if (!await CanSyndicateListingsAsync())
            {
                listingDto.SyndicateToListingWebsite = false;
                listingDto.SyndicateToFreeSites = false;
                listingDto.SyndicateToPremiumSites = false;
            }

            if (!await CanUseTenantScreeningAsync())
                ClearTenantScreeningConfiguration(listingDto);

            var response = await _listingService.CreateListing(listingDto, files);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateListing(long id, [FromBody] UpdateListingDto listingDto)
        {
            listingDto.Id = id;
            if (!await CanSyndicateListingsAsync())
            {
                listingDto.SyndicateToListingWebsite = false;
                listingDto.SyndicateToFreeSites = false;
                listingDto.SyndicateToPremiumSites = false;
            }

            if (!await CanUseTenantScreeningAsync())
                ClearTenantScreeningConfiguration(listingDto);

            var response = await _listingService.UpdateListing(listingDto);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data });
        }

        [HttpPost("{id}/publish")]
        public async Task<IActionResult> PublishListing(long id)
        {
            var identity = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("userId")
                ?? User.FindFirstValue("sub");
            if (!long.TryParse(identity, out var userId))
                return Unauthorized(new { Message = "A valid authenticated user identity is required to publish a listing." });

            FeatureReadinessDto readiness;
            try
            {
                readiness = await _featureReadinessService.GetAsync(
                    userId, GetCanonicalOrganizationId(), FeatureKeys.ListingSyndication);
            }
            catch
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    Message = "Listing publication readiness could not be confirmed. Please try again later.",
                    Feature = FeatureKeys.ListingSyndication,
                });
            }

            if (!readiness.CanInvoke)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Message = "Listing publication is not ready for use.",
                    readiness.Feature,
                    readiness.State,
                    readiness.Blockers,
                });
            }

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

        private async Task<bool> CanSyndicateListingsAsync()
            => await CanInvokeFeatureAsync(FeatureKeys.ListingSyndication);

        private async Task<bool> CanUseTenantScreeningAsync()
            => await CanInvokeFeatureAsync(FeatureKeys.TenantScreening);

        private async Task<bool> CanInvokeFeatureAsync(string feature)
        {
            var identity = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("userId")
                ?? User.FindFirstValue("sub");
            if (!long.TryParse(identity, out var userId))
                return false;

            try
            {
                var readiness = await _featureReadinessService.GetAsync(userId, GetCanonicalOrganizationId(), feature);
                return readiness.CanInvoke;
            }
            catch
            {
                return false;
            }
        }

        private long? GetCanonicalOrganizationId() =>
            HttpContext.Items.TryGetValue("OrganizationId", out var value) && value is long organizationId && organizationId > 0
                ? organizationId
                : null;

        private static void ClearTenantScreeningConfiguration(CreateListingDto listingDto)
        {
            listingDto.RequireScreening = false;
            listingDto.ScreeningType = null;
            listingDto.RequireIncomeVerification = false;
            listingDto.IncomeVerificationCost = 0;
        }

        private static void ClearTenantScreeningConfiguration(UpdateListingDto listingDto)
        {
            listingDto.RequireScreening = false;
            listingDto.ScreeningType = null;
            listingDto.RequireIncomeVerification = false;
            listingDto.IncomeVerificationCost = 0;
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
