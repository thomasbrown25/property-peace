using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Services.AIFollowUpService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class AIFollowUpController(
        IAIFollowUpService aiFollowUpService,
        IUserService userService,
        ILogger<AIFollowUpController> logger) : ControllerBase
    {
        private readonly IAIFollowUpService _aiFollowUpService = aiFollowUpService;
        private readonly IUserService _userService = userService;
        private readonly ILogger<AIFollowUpController> _logger = logger;

        private async Task<long> GetLandlordIdAsync()
        {
            // Try to get user ID directly from claims first
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }

            // If user ID not in claims, get email from "sub" claim (JWT standard)
            var email = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(email))
            {
                email = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            }
            if (string.IsNullOrEmpty(email))
            {
                email = User.FindFirst(ClaimTypes.Name)?.Value;
            }

            if (!string.IsNullOrEmpty(email))
            {
                try
                {
                    var userResponse = await _userService.GetUserByEmailAsync(email);
                    if (userResponse.Success && userResponse.Data != null)
                    {
                        return userResponse.Data.Id;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error getting user by email {Email}", email);
                }
            }

            throw new UnauthorizedAccessException("Unable to determine user ID");
        }

        [HttpPost("preview")]
        public async Task<IActionResult> PreviewAIFollowUp([FromBody] SendAIFollowUpDto request)
        {
            try
            {
                var response = await _aiFollowUpService.PreviewAIFollowUpAsync(request);
                if (!response.Success)
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                return Ok(response);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating AI follow-up preview");
                return StatusCode(500, new { message = "An error occurred while generating the preview", error = ex.Message });
            }
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendAIFollowUp([FromBody] SendAIFollowUpDto request)
        {
            try
            {
                var landlordId = await GetLandlordIdAsync();
                var response = await _aiFollowUpService.SendAIFollowUpAsync(request, landlordId);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending AI follow-up");
                return StatusCode(500, new { message = "An error occurred while sending the follow-up", error = ex.Message });
            }
        }
    }
}
