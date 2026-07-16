using brownstone_hub_api.Dtos.TimeTrackingSettings;
using brownstone_hub_api.Services.TimeTrackingSettingsService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/time-tracking-settings")]
    [Authorize(Roles = "Landlord,Admin")]
    public class TimeTrackingSettingsController(ITimeTrackingSettingsService timeTrackingSettingsService) : ControllerBase
    {
        private readonly ITimeTrackingSettingsService _timeTrackingSettingsService = timeTrackingSettingsService;

        [HttpGet]
        public async Task<IActionResult> GetSettings()
        {
            var response = await _timeTrackingSettingsService.GetSettings();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateTimeTrackingSettingsDto dto)
        {
            var response = await _timeTrackingSettingsService.UpdateSettings(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}
