using brownstone_hub_api.Services.StateDepositLawService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class StateDepositLawController : ControllerBase
    {
        private readonly IStateDepositLawService _stateDepositLawService;
        private readonly ILogger<StateDepositLawController> _logger;

        public StateDepositLawController(
            IStateDepositLawService stateDepositLawService,
            ILogger<StateDepositLawController> logger)
        {
            _stateDepositLawService = stateDepositLawService;
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

                var law = await _stateDepositLawService.GetStateLawAsync(state.ToUpper());

                if (law == null)
                {
                    return NotFound(new { message = $"Deposit law not found for state {state}" });
                }

                var bulletPoints = string.IsNullOrWhiteSpace(law.BulletPointsText)
                    ? Array.Empty<string>()
                    : law.BulletPointsText
                        .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                        .Select(s => s.Trim())
                        .Where(s => s.Length > 0)
                        .ToArray();

                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        id = law.Id,
                        state = law.State,
                        bulletPoints,
                        lastUpdated = law.LastUpdated,
                        lastUpdatedBy = law.LastUpdatedBy
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting state deposit law for {State}", state);
                return StatusCode(500, new { message = "An error occurred while retrieving state deposit law" });
            }
        }
    }
}
