using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Services.AdminSettingsService;
using brownstone_hub_api.Dtos.AdminSettings;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/settings")]
    [Authorize(Roles = "Admin")]
    public class AdminSettingsController : ControllerBase
    {
        private readonly IAdminSettingsService _adminSettingsService;
        private readonly ILogger<AdminSettingsController> _logger;

        public AdminSettingsController(
            IAdminSettingsService adminSettingsService,
            ILogger<AdminSettingsController> logger)
        {
            _adminSettingsService = adminSettingsService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetAdminSettings()
        {
            try
            {
                var response = await _adminSettingsService.GetAdminSettings();
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting admin settings");
                return StatusCode(500, new { message = "An error occurred while retrieving admin settings" });
            }
        }

        [HttpPut]
        public async Task<IActionResult> UpdateAdminSettings([FromBody] UpdateAdminSettingsDto dto)
        {
            try
            {
                var response = await _adminSettingsService.UpdateAdminSettings(dto.NotificationEmail ?? string.Empty, dto.AllPremiumFeaturesOnFreePlan);
                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating admin settings");
                return StatusCode(500, new { message = "An error occurred while updating admin settings" });
            }
        }
    }
}

