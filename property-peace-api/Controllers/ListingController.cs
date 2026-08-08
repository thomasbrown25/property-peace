using System.Security.Claims;
using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.FeatureReadiness;
using brownstone_hub_api.Services.ListingService;
using brownstone_hub_api.Services.ListingAIService;
using brownstone_hub_api.Services.SubscriptionService;
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
        IFeatureReadinessService featureReadinessService,
        IFeatureGateService featureGateService) : ControllerBase
    {
        private readonly IListingService _listingService = listingService;
        private readonly IListingAIService _listingAIService = listingAIService;
        private readonly IFeatureReadinessService _featureReadinessService = featureReadinessService;
        private readonly IFeatureGateService _featureGateService = featureGateService;

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
            await ApplyExternalSyndicationPolicyAsync(listingDto);

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
            await ApplyExternalSyndicationPolicyAsync(listingDto, id);

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
            // Re-apply the external policy at publication time so multiple drafts cannot bypass
            // the Free plan's active-listing allowance. Hosted publication remains independent:
            // blocked external flags are cleared instead of blocking the Property Peace page.
            var listingResponse = await _listingService.GetListingById(id);
            if (!listingResponse.Success || listingResponse.Data == null)
                return StatusCode(listingResponse.StatusCode, new { listingResponse.Message, listingResponse.Errors });

            var externalUpdate = new UpdateListingDto
            {
                Id = id,
                SyndicateToFreeSites = listingResponse.Data.SyndicateToFreeSites,
                SyndicateToPremiumSites = listingResponse.Data.SyndicateToPremiumSites,
            };
            await ApplyExternalSyndicationPolicyAsync(externalUpdate, id);

            if (externalUpdate.SyndicateToFreeSites != listingResponse.Data.SyndicateToFreeSites ||
                externalUpdate.SyndicateToPremiumSites != listingResponse.Data.SyndicateToPremiumSites)
            {
                var updateResponse = await _listingService.UpdateListing(externalUpdate);
                if (!updateResponse.Success)
                    return StatusCode(updateResponse.StatusCode, new { updateResponse.Message, updateResponse.Errors });
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

        private async Task ApplyExternalSyndicationPolicyAsync(CreateListingDto listingDto)
        {
            var entitlement = await GetSyndicationEntitlementAsync();
            if (!await CanSyndicateListingsAsync() || !entitlement.CanUseCoreDestinations)
            {
                listingDto.SyndicateToFreeSites = false;
                listingDto.SyndicateToPremiumSites = false;
                return;
            }

            if (!entitlement.CanUseExtendedDestinations)
                listingDto.SyndicateToPremiumSites = false;

            if (listingDto.SyndicateToFreeSites == true &&
                await HasReachedExternalListingLimitAsync(entitlement, excludeListingId: null))
            {
                listingDto.SyndicateToFreeSites = false;
                listingDto.SyndicateToPremiumSites = false;
            }
        }

        private async Task ApplyExternalSyndicationPolicyAsync(UpdateListingDto listingDto, long listingId)
        {
            var entitlement = await GetSyndicationEntitlementAsync();
            if (!await CanSyndicateListingsAsync() || !entitlement.CanUseCoreDestinations)
            {
                listingDto.SyndicateToFreeSites = false;
                listingDto.SyndicateToPremiumSites = false;
                return;
            }

            if (!entitlement.CanUseExtendedDestinations)
                listingDto.SyndicateToPremiumSites = false;

            if (listingDto.SyndicateToFreeSites == true &&
                await HasReachedExternalListingLimitAsync(entitlement, listingId))
            {
                listingDto.SyndicateToFreeSites = false;
                listingDto.SyndicateToPremiumSites = false;
            }
        }

        private async Task<ListingSyndicationEntitlement> GetSyndicationEntitlementAsync()
        {
            if (!TryGetCurrentUserId(out var userId))
                return ListingSyndicationEntitlement.None;

            try
            {
                return await _featureGateService.GetListingSyndicationEntitlementAsync(userId);
            }
            catch
            {
                return ListingSyndicationEntitlement.None;
            }
        }

        private async Task<bool> HasReachedExternalListingLimitAsync(
            ListingSyndicationEntitlement entitlement,
            long? excludeListingId)
        {
            if (!entitlement.MaxActiveExternalListings.HasValue)
                return false;

            var response = await _listingService.GetListingsByOrganization();
            if (!response.Success || response.Data == null)
                return true;

            var activeExternalCount = response.Data.Count(listing =>
                listing.Id != excludeListingId &&
                listing.Status == EListingStatus.Active &&
                (listing.SyndicateToFreeSites || listing.SyndicateToPremiumSites));

            return activeExternalCount >= entitlement.MaxActiveExternalListings.Value;
        }

        private async Task<bool> CanUseTenantScreeningAsync()
            => await CanInvokeFeatureAsync(FeatureKeys.TenantScreening);

        private async Task<bool> CanInvokeFeatureAsync(string feature)
        {
            if (!TryGetCurrentUserId(out var userId))
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

        private bool TryGetCurrentUserId(out long userId)
        {
            var identity = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("userId")
                ?? User.FindFirstValue("sub");
            return long.TryParse(identity, out userId);
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
