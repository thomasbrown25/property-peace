using brownstone_hub_api.Dtos.Feature;
using brownstone_hub_api.Repositories.Features;
using brownstone_hub_api.Services.UserContextService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class FeatureController(IFeatureRepository featureRepository, IUserContextService userContextService, IHttpContextAccessor httpContextAccessor) : ControllerBase
    {
        private readonly IFeatureRepository _featureRepository = featureRepository;
        private readonly IUserContextService _userContextService = userContextService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;

        private long? GetCurrentOrganizationId()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
                return orgId;
            return null;
        }

        [HttpGet("default")]
        public async Task<IActionResult> GetDefaultFeatures()
        {
            try
            {
                var features = await _featureRepository.GetDefaultFeatures();
                return Ok(new { success = true, data = features });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpGet("custom")]
        public async Task<IActionResult> GetCustomFeatures()
        {
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                    return StatusCode(403, new { success = false, message = "Organization context required" });

                var features = await _featureRepository.GetCustomFeaturesByOrganizationId(organizationId.Value);
                return Ok(new { success = true, data = features });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpPost("custom")]
        public async Task<IActionResult> CreateCustomFeature([FromBody] CreateCustomFeatureDto dto)
        {
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                    return StatusCode(403, new { success = false, message = "Organization context required" });

                var userId = await _userContextService.GetCurrentUserIdAsync();
                if (!userId.HasValue)
                    return StatusCode(403, new { success = false, message = "User context required" });

                var feature = await _featureRepository.CreateCustomFeature(dto, organizationId.Value, userId.Value);
                return Ok(new { success = true, data = feature });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpDelete("custom/{id}")]
        public async Task<IActionResult> DeleteCustomFeature(long id)
        {
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                    return StatusCode(403, new { success = false, message = "Organization context required" });

                var deleted = await _featureRepository.DeleteCustomFeature(id, organizationId.Value);
                if (!deleted)
                    return NotFound(new { success = false, message = "Custom feature not found" });

                return Ok(new { success = true, message = "Custom feature deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
    }
}
