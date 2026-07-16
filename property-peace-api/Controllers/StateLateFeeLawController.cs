using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StateLateFeeLawService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class StateLateFeeLawController : ControllerBase
    {
        private readonly IStateLateFeeLawService _stateLateFeeLawService;
        private readonly ILogger<StateLateFeeLawController> _logger;

        public StateLateFeeLawController(
            IStateLateFeeLawService stateLateFeeLawService,
            ILogger<StateLateFeeLawController> logger)
        {
            _stateLateFeeLawService = stateLateFeeLawService;
            _logger = logger;
        }

        [HttpGet("{state}")]
        public async Task<IActionResult> GetStateLaw(string state)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(state))
                {
                    return BadRequest(new { message = "State is required" });
                }

                var law = await _stateLateFeeLawService.GetStateLawAsync(state.ToUpper());

                if (law == null)
                {
                    return NotFound(new { message = $"Late fee law not found for state {state}" });
                }

                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        id = law.Id,
                        state = law.State,
                        gracePeriodDescription = law.GracePeriodDescription,
                        feeAmountDescription = law.FeeAmountDescription,
                        lastUpdated = law.LastUpdated,
                        lastUpdatedBy = law.LastUpdatedBy
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting state law for {State}", state);
                return StatusCode(500, new { message = "An error occurred while retrieving state law" });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetAllStateLaws()
        {
            try
            {
                var laws = await _stateLateFeeLawService.GetAllStateLawsAsync();

                return Ok(new
                {
                    success = true,
                    data = laws.Select(l => new
                    {
                        id = l.Id,
                        state = l.State,
                        gracePeriodDescription = l.GracePeriodDescription,
                        feeAmountDescription = l.FeeAmountDescription,
                        lastUpdated = l.LastUpdated,
                        lastUpdatedBy = l.LastUpdatedBy
                    }).ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all state laws");
                return StatusCode(500, new { message = "An error occurred while retrieving state laws" });
            }
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateStateLaw([FromBody] UpdateStateLateFeeLawDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.State))
                {
                    return BadRequest(new { message = "State is required" });
                }

                var law = await _stateLateFeeLawService.UpdateStateLawAsync(
                    dto.State.ToUpper(),
                    dto.GracePeriodDescription,
                    dto.FeeAmountDescription,
                    "Manual"
                );

                return Ok(new
                {
                    success = true,
                    message = "State law updated successfully",
                    data = new
                    {
                        id = law.Id,
                        state = law.State,
                        gracePeriodDescription = law.GracePeriodDescription,
                        feeAmountDescription = law.FeeAmountDescription,
                        lastUpdated = law.LastUpdated,
                        lastUpdatedBy = law.LastUpdatedBy
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating state law for {State}", dto.State);
                return StatusCode(500, new { message = "An error occurred while updating state law" });
            }
        }
    }

    public class UpdateStateLateFeeLawDto
    {
        public string State { get; set; } = string.Empty;
        public string? GracePeriodDescription { get; set; }
        public string? FeeAmountDescription { get; set; }
    }
}
