using System.Security.Claims;
using brownstone_hub_api.Dtos.LeaseShield;
using brownstone_hub_api.Services.LeaseShieldService;
using brownstone_hub_api.Services.SubscriptionService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/lease-shield")]
    [Authorize(Roles = "Landlord,Admin,Tenant")]
    public class LeaseShieldController(
        ILeaseShieldService leaseShieldService,
        IUserService userService,
        IFeatureGateService featureGateService,
        ILogger<LeaseShieldController> logger) : ControllerBase
    {
        private readonly ILeaseShieldService _leaseShieldService = leaseShieldService;
        private readonly IUserService _userService = userService;
        private readonly IFeatureGateService _featureGateService = featureGateService;
        private readonly ILogger<LeaseShieldController> _logger = logger;

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

        private async Task<IActionResult?> RequireLeaseShieldAccessAsync(long userId)
        {
            var hasAccess = await _featureGateService.HasLeaseShieldAccessAsync(userId);
            if (!hasAccess)
            {
                return StatusCode(403, new { success = false, message = "LeaseShield is a Premium feature. Upgrade your subscription to use it." });
            }
            return null;
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations(CancellationToken cancellationToken)
        {
            var userId = await GetUserIdAsync();
            if (userId == 0) return Unauthorized();
            var accessResult = await RequireLeaseShieldAccessAsync(userId);
            if (accessResult != null) return accessResult;

            var response = await _leaseShieldService.GetConversationsAsync(userId, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("conversations/{id:long}")]
        public async Task<IActionResult> GetConversation(long id, CancellationToken cancellationToken)
        {
            var userId = await GetUserIdAsync();
            if (userId == 0) return Unauthorized();
            var accessResult = await RequireLeaseShieldAccessAsync(userId);
            if (accessResult != null) return accessResult;

            var response = await _leaseShieldService.GetConversationAsync(id, userId, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("conversations")]
        public async Task<IActionResult> CreateConversation([FromBody] CreateLeaseShieldConversationRequest request, CancellationToken cancellationToken)
        {
            var userId = await GetUserIdAsync();
            if (userId == 0) return Unauthorized();
            var accessResult = await RequireLeaseShieldAccessAsync(userId);
            if (accessResult != null) return accessResult;

            var response = await _leaseShieldService.CreateConversationAsync(userId, request, null, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("conversations/{id:long}")]
        public async Task<IActionResult> UpdateConversation(long id, [FromBody] UpdateLeaseShieldConversationRequest request, CancellationToken cancellationToken)
        {
            var userId = await GetUserIdAsync();
            if (userId == 0) return Unauthorized();
            var accessResult = await RequireLeaseShieldAccessAsync(userId);
            if (accessResult != null) return accessResult;

            var response = await _leaseShieldService.UpdateConversationTitleAsync(id, userId, request, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("conversations/{id:long}")]
        public async Task<IActionResult> DeleteConversation(long id, CancellationToken cancellationToken)
        {
            var userId = await GetUserIdAsync();
            if (userId == 0) return Unauthorized();
            var accessResult = await RequireLeaseShieldAccessAsync(userId);
            if (accessResult != null) return accessResult;

            var response = await _leaseShieldService.DeleteConversationAsync(id, userId, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("conversations/{id:long}/messages")]
        public async Task<IActionResult> SendMessage(long id, [FromBody] SendLeaseShieldMessageRequest request, CancellationToken cancellationToken)
        {
            var userId = await GetUserIdAsync();
            if (userId == 0) return Unauthorized();
            var accessResult = await RequireLeaseShieldAccessAsync(userId);
            if (accessResult != null) return accessResult;

            var response = await _leaseShieldService.SendMessageAsync(id, userId, request, null, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("messages")]
        public async Task<IActionResult> SendMessageNewConversation([FromBody] SendLeaseShieldMessageRequest request, CancellationToken cancellationToken)
        {
            var userId = await GetUserIdAsync();
            if (userId == 0) return Unauthorized();
            var accessResult = await RequireLeaseShieldAccessAsync(userId);
            if (accessResult != null) return accessResult;

            var response = await _leaseShieldService.SendMessageAsync(null, userId, request, null, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }
    }
}
