using brownstone_hub_api.Services.StorageService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/storage")]
    [Authorize(Roles = "Admin")]
    public class AdminStorageController : ControllerBase
    {
        private readonly IStorageService _storageService;
        private readonly ILogger<AdminStorageController> _logger;

        public AdminStorageController(IStorageService storageService, ILogger<AdminStorageController> logger)
        {
            _storageService = storageService;
            _logger = logger;
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            try
            {
                return Ok(new { success = true, data = await _storageService.GetSummaryAsync() });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading admin storage summary");
                return StatusCode(500, new { success = false, message = "Failed to load storage summary" });
            }
        }

        [HttpGet("organizations")]
        public async Task<IActionResult> GetOrganizations()
        {
            try
            {
                return Ok(new { success = true, data = await _storageService.GetOrganizationsAsync() });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading organization storage usage");
                return StatusCode(500, new { success = false, message = "Failed to load organization storage usage" });
            }
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            try
            {
                return Ok(new { success = true, data = await _storageService.GetUsersAsync() });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading user storage usage");
                return StatusCode(500, new { success = false, message = "Failed to load user storage usage" });
            }
        }

        [HttpGet("users/{userId:long}")]
        public async Task<IActionResult> GetUser(long userId)
        {
            try
            {
                var result = await _storageService.GetUserAsync(userId);
                return result == null
                    ? NotFound(new { success = false, message = "User not found" })
                    : Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading user storage usage for {UserId}", userId);
                return StatusCode(500, new { success = false, message = "Failed to load user storage usage" });
            }
        }

        [HttpGet("organizations/{organizationId:long}")]
        public async Task<IActionResult> GetOrganization(long organizationId)
        {
            try
            {
                var result = await _storageService.GetOrganizationAsync(organizationId);
                return result == null
                    ? NotFound(new { success = false, message = "Organization not found" })
                    : Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading organization storage usage for {OrganizationId}", organizationId);
                return StatusCode(500, new { success = false, message = "Failed to load organization storage usage" });
            }
        }
    }
}
