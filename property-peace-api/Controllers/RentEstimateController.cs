using System.Security.Claims;
using brownstone_hub_api.Services.RentEstimateService;
using brownstone_hub_api.Services.SubscriptionService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/rent-estimate")]
    [Authorize(Roles = "Landlord,Admin")]
    public class RentEstimateController(
        IRentEstimateService rentEstimateService,
        IUserService userService,
        IFeatureGateService featureGateService,
        ILogger<RentEstimateController> logger) : ControllerBase
    {
        private readonly IRentEstimateService _rentEstimateService = rentEstimateService;
        private readonly IUserService _userService = userService;
        private readonly IFeatureGateService _featureGateService = featureGateService;
        private readonly ILogger<RentEstimateController> _logger = logger;

        private async Task<long> GetUserIdAsync()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var userId))
                return userId;

            var email = User.FindFirst("sub")?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(ClaimTypes.Name)?.Value;
            if (!string.IsNullOrEmpty(email))
            {
                try
                {
                    var userResponse = await _userService.GetUserByEmailAsync(email);
                    return userResponse.Success && userResponse.Data != null ? userResponse.Data.Id : 0;
                }
                catch { return 0; }
            }
            return 0;
        }

        /// <summary>
        /// GET /api/rent-estimate?propertyId=1&unitId=2&forceRefresh=true
        /// Returns a rent estimate for the given unit, sourced from Rentcast (with caching).
        /// Requires Premium subscription. Cached estimates are reused for 3 months unless forceRefresh is true.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetRentEstimate([FromQuery] long propertyId, [FromQuery] long? unitId, [FromQuery] bool forceRefresh, CancellationToken cancellationToken)
        {
            var userId = await GetUserIdAsync();
            if (userId == 0) return Unauthorized();

            var hasAccess = await _featureGateService.HasFeatureAccessAsync(userId, "RentEstimate");
            if (!hasAccess)
                return StatusCode(403, new { success = false, message = "Rent Estimate is a Premium feature. Upgrade your subscription to access it." });

            if (propertyId <= 0)
                return BadRequest(new { success = false, message = "propertyId is required." });

            try
            {
                var result = await _rentEstimateService.GetRentEstimateAsync(propertyId, unitId, forceRefresh, cancellationToken);
                if (result == null)
                    return NotFound(new { success = false, message = "Could not retrieve a rent estimate for this unit. Verify the property address is complete." });

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching rent estimate for property {PropertyId}, unit {UnitId}", propertyId, unitId);
                return StatusCode(500, new { success = false, message = "An error occurred while fetching the rent estimate." });
            }
        }
    }
}
