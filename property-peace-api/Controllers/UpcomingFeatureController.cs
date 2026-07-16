using brownstone_hub_api.Dtos.UpcomingFeature;
using brownstone_hub_api.Services.UpcomingFeatureService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UpcomingFeatureController(IUpcomingFeatureService upcomingFeatureService) : ControllerBase
    {
        private readonly IUpcomingFeatureService _upcomingFeatureService = upcomingFeatureService;

        // Admin only - Get all features (including inactive)
        [Authorize(Roles = "Admin")]
        [HttpGet("admin/all")]
        public async Task<IActionResult> GetAllUpcomingFeatures()
        {
            var response = await _upcomingFeatureService.GetAllUpcomingFeatures();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        // Public/Landlord - Get only active features
        [Authorize]
        [HttpGet("active")]
        public async Task<IActionResult> GetActiveUpcomingFeatures()
        {
            var response = await _upcomingFeatureService.GetActiveUpcomingFeatures();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        // Admin only - Get feature by ID
        [Authorize(Roles = "Admin")]
        [HttpGet("admin/{id}")]
        public async Task<IActionResult> GetUpcomingFeatureById(long id)
        {
            var response = await _upcomingFeatureService.GetUpcomingFeatureById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        // Admin only - Create feature
        [Authorize(Roles = "Admin")]
        [HttpPost("admin")]
        public async Task<IActionResult> AddUpcomingFeature([FromBody] AddUpcomingFeatureDto feature)
        {
            var response = await _upcomingFeatureService.AddUpcomingFeature(feature);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        // Admin only - Update feature
        [Authorize(Roles = "Admin")]
        [HttpPut("admin/{id}")]
        public async Task<IActionResult> UpdateUpcomingFeature(long id, [FromBody] UpdateUpcomingFeatureDto feature)
        {
            if (id != feature.Id)
                return BadRequest(new { Message = "Feature ID mismatch" });

            var response = await _upcomingFeatureService.UpdateUpcomingFeature(feature);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        // Admin only - Delete feature
        [Authorize(Roles = "Admin")]
        [HttpDelete("admin/{id}")]
        public async Task<IActionResult> DeleteUpcomingFeature(long id)
        {
            var response = await _upcomingFeatureService.DeleteUpcomingFeature(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}

