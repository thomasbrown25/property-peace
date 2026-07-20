using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Services.AdminSettingsService;
using brownstone_hub_api.Dtos.AdminSettings;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/settings")]
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
        [Authorize(Roles = "Admin")]
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
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateAdminSettings([FromBody] UpdateAdminSettingsDto dto)
        {
            try
            {
                var response = await _adminSettingsService.UpdateAdminSettings(
                    dto.NotificationEmail ?? string.Empty,
                    dto.AllPremiumFeaturesOnFreePlan,
                    dto.MaintenanceModeEnabled,
                    dto.MaintenanceTitle,
                    dto.MaintenanceMessage,
                    dto.MaintenanceSupportEmail);
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

        [HttpGet("app-status")]
        [AllowAnonymous]
        public async Task<IActionResult> GetAppStatus()
        {
            try
            {
                var response = await _adminSettingsService.GetAppStatus();
                if (!response.Success)
                {
                    return Ok(new
                    {
                        maintenanceModeEnabled = false,
                        maintenanceTitle = "Property Peace is getting a quick tune-up",
                        maintenanceMessage = "We’re making updates to improve reliability and performance. Please check back shortly.",
                        maintenanceSupportEmail = "support@propertypeace.io"
                    });
                }

                return Ok(response.Data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting app status");
                return Ok(new
                {
                    maintenanceModeEnabled = false,
                    maintenanceTitle = "Property Peace is getting a quick tune-up",
                    maintenanceMessage = "We’re making updates to improve reliability and performance. Please check back shortly.",
                    maintenanceSupportEmail = "support@propertypeace.io"
                });
            }
        }

        [HttpPut("maintenance")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateMaintenanceSettings([FromBody] AppStatusDto dto)
        {
            try
            {
                var response = await _adminSettingsService.UpdateMaintenanceSettings(
                    dto.MaintenanceModeEnabled,
                    dto.MaintenanceTitle,
                    dto.MaintenanceMessage,
                    dto.MaintenanceSupportEmail);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating maintenance settings");
                return StatusCode(500, new { message = "An error occurred while updating maintenance settings" });
            }
        }
    }
}

