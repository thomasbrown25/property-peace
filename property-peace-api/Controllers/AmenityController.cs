using brownstone_hub_api.Dtos.Amenity;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Amenities;
using brownstone_hub_api.Services.UserContextService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class AmenityController(IAmenityRepository amenityRepository, IUserContextService userContextService, IHttpContextAccessor httpContextAccessor) : ControllerBase
    {
        private readonly IAmenityRepository _amenityRepository = amenityRepository;
        private readonly IUserContextService _userContextService = userContextService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;

        private long? GetCurrentOrganizationId()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        [HttpGet("basic")]
        public async Task<IActionResult> GetBasicAmenities()
        {
            try
            {
                var amenities = await _amenityRepository.GetBasicAmenities();
                return Ok(new { success = true, data = amenities });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("default")]
        public async Task<IActionResult> GetDefaultAmenities([FromQuery] string? category = null)
        {
            try
            {
                List<LoadDefaultAmenityDto> amenities;
                if (!string.IsNullOrEmpty(category))
                {
                    amenities = await _amenityRepository.GetDefaultAmenitiesByCategory(category);
                }
                else
                {
                    amenities = await _amenityRepository.GetDefaultAmenities();
                }
                return Ok(new { success = true, data = amenities });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("custom")]
        public async Task<IActionResult> GetCustomAmenities()
        {
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    return StatusCode(403, new { success = false, message = "Organization context required" });
                }

                var amenities = await _amenityRepository.GetCustomAmenitiesByOrganizationId(organizationId.Value);
                return Ok(new { success = true, data = amenities });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpPost("custom")]
        public async Task<IActionResult> CreateCustomAmenity([FromBody] CreateCustomAmenityDto amenityDto)
        {
            try
            {
                // Custom amenities are only for property amenities; use CustomFeature for custom features
                if (amenityDto.Category != EAmenityCategory.PropertyAmenity)
                {
                    return BadRequest(new { success = false, message = "Custom amenities must use category PropertyAmenity. Use the feature API for custom features." });
                }
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    return StatusCode(403, new { success = false, message = "Organization context required" });
                }

                var userId = await _userContextService.GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    return StatusCode(403, new { success = false, message = "User context required" });
                }

                var amenity = await _amenityRepository.CreateCustomAmenity(amenityDto, organizationId.Value, userId.Value);
                return Ok(new { success = true, data = amenity });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpDelete("custom/{id}")]
        public async Task<IActionResult> DeleteCustomAmenity(long id)
        {
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    return StatusCode(403, new { success = false, message = "Organization context required" });
                }

                var deleted = await _amenityRepository.DeleteCustomAmenity(id, organizationId.Value);
                if (!deleted)
                {
                    return NotFound(new { success = false, message = "Custom amenity not found" });
                }

                return Ok(new { success = true, message = "Custom amenity deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
    }
}
