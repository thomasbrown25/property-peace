using brownstone_hub_api.Helpers;
using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Services.AICopilotService;
using brownstone_hub_api.Services.AgentFollowUpService;
using brownstone_hub_api.Services.PercyActions;
using brownstone_hub_api.Config;
using brownstone_hub_api.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/ai-copilot")]
    [Authorize(Roles = "Landlord,Admin")]
    [RequireFeatureReady(FeatureKeys.Percy)]
    public class AICopilotController(
        IAICopilotService aiCopilotService,
        IAgentFollowUpService agentFollowUpService,
        IUserRepository userRepository,
        IOrganizationMemberRepository organizationMemberRepository,
        ILogger<AICopilotController> logger) : ControllerBase
    {
        private readonly IAICopilotService _aiCopilotService = aiCopilotService;
        private readonly IAgentFollowUpService _agentFollowUpService = agentFollowUpService;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IOrganizationMemberRepository _organizationMemberRepository = organizationMemberRepository;
        private readonly ILogger<AICopilotController> _logger = logger;

        [Authorize]
        [HttpGet("organization-summary")]
        public async Task<IActionResult> GetOrganizationSummary()
        {
            var context = await GetPercyContextAsync();
            if (!context.OrganizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var response = await _aiCopilotService.GetOrganizationSummary(context.OrganizationId.Value);
            return PercyResult(response);
        }

        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] PercyChatRequestDto request, CancellationToken cancellationToken)
        {
            var context = await GetPercyContextAsync();
            if (!context.OrganizationId.HasValue) return StatusCode(403, new { Message = "Organization context is required" });
            if (!context.UserId.HasValue) return Unauthorized(new { Message = "Authenticated user context is required" });
            var response = await _aiCopilotService.ChatAsync(context.OrganizationId.Value, context.UserId.Value, request, cancellationToken);
            return PercyResult(response);
        }

        [HttpPost("chat/stream")]
        public async Task StreamChat([FromBody] PercyChatRequestDto request, CancellationToken cancellationToken)
        {
            var context = await GetPercyContextAsync();
            Response.ContentType = "application/x-ndjson";
            Response.Headers.CacheControl = "no-cache, no-transform";
            Response.Headers.Append("X-Accel-Buffering", "no");

            async Task WriteEventAsync(object value)
            {
                await Response.WriteAsync(JsonSerializer.Serialize(value, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                }) + "\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }

            if (!context.OrganizationId.HasValue || !context.UserId.HasValue)
            {
                Response.StatusCode = context.OrganizationId.HasValue ? 401 : 403;
                await WriteEventAsync(new { type = "error", message = "Authenticated organization context is required." });
                return;
            }

            await WriteEventAsync(new { type = "status", message = "Let me take a look…" });

            var result = await _aiCopilotService.ChatAsync(
                context.OrganizationId.Value,
                context.UserId.Value,
                request,
                cancellationToken);

            if (!result.Success || result.Data == null)
            {
                await WriteEventAsync(new { type = "error", message = result.Message });
                return;
            }

            var content = result.Data.Content ?? string.Empty;
            for (var offset = 0; offset < content.Length; offset += 48)
            {
                var length = Math.Min(48, content.Length - offset);
                await WriteEventAsync(new { type = "content.delta", delta = content.Substring(offset, length) });
                await Task.Delay(12, cancellationToken);
            }

            await WriteEventAsync(new { type = "completed", response = result.Data });
        }

        [HttpGet("conversations")]
        public async Task<IActionResult> ListConversations([FromQuery] bool includeArchived = false, CancellationToken cancellationToken = default)
        {
            var context = await GetPercyContextAsync();
            if (!context.OrganizationId.HasValue) return StatusCode(403, new { Message = "Organization context is required" });
            if (!context.UserId.HasValue) return Unauthorized(new { Message = "Authenticated user context is required" });
            var response = await _aiCopilotService.ListConversationsAsync(context.OrganizationId.Value, context.UserId.Value, includeArchived, cancellationToken);
            return PercyResult(response);
        }

        [HttpGet("conversations/{conversationId:long}")]
        public async Task<IActionResult> GetConversation(long conversationId, CancellationToken cancellationToken)
        {
            var context = await GetPercyContextAsync();
            if (!context.OrganizationId.HasValue) return StatusCode(403, new { Message = "Organization context is required" });
            if (!context.UserId.HasValue) return Unauthorized(new { Message = "Authenticated user context is required" });
            var response = await _aiCopilotService.GetConversationAsync(context.OrganizationId.Value, context.UserId.Value, conversationId, cancellationToken);
            return PercyResult(response);
        }

        [HttpDelete("conversations/{conversationId:long}")]
        public async Task<IActionResult> DeleteConversation(long conversationId, CancellationToken cancellationToken)
        {
            var context = await GetPercyContextAsync();
            if (!context.OrganizationId.HasValue) return StatusCode(403, new { Message = "Organization context is required" });
            if (!context.UserId.HasValue) return Unauthorized(new { Message = "Authenticated user context is required" });
            var response = await _aiCopilotService.DeleteConversationAsync(context.OrganizationId.Value, context.UserId.Value, conversationId, cancellationToken);
            return PercyResult(response);
        }

        [HttpPost("confirmations/{confirmationId:long}/confirm")]
        public async Task<IActionResult> ConfirmAction(long confirmationId, CancellationToken cancellationToken)
        {
            var context = await GetPercyContextAsync();
            if (!context.OrganizationId.HasValue) return StatusCode(403, new { Message = "Organization context is required" });
            if (!context.UserId.HasValue) return Unauthorized(new { Message = "Authenticated user context is required" });
            var response = await _aiCopilotService.ConfirmActionAsync(context.OrganizationId.Value, context.UserId.Value, confirmationId, cancellationToken);
            return PercyResult(response);
        }

        [HttpPost("confirmations/{confirmationId:long}/decline")]
        public async Task<IActionResult> DeclineAction(long confirmationId, CancellationToken cancellationToken)
        {
            var context = await GetPercyContextAsync();
            if (!context.OrganizationId.HasValue) return StatusCode(403, new { Message = "Organization context is required" });
            if (!context.UserId.HasValue) return Unauthorized(new { Message = "Authenticated user context is required" });
            var response = await _aiCopilotService.DeclineConfirmationAsync(context.OrganizationId.Value, context.UserId.Value, confirmationId, cancellationToken);
            return PercyResult(response);
        }

        /// <summary>Disabled because the existing sweep is platform-wide, not organization-scoped.</summary>
        [HttpPost("agents/overdue-rent-sweep")]
        public IActionResult TriggerOverdueRentSweep()
        {
            return StatusCode(409, new { message = "This platform-wide action is unavailable from a landlord-scoped endpoint." });
        }

        [HttpGet("agents/dashboard-summary")]
        public async Task<IActionResult> GetAgentDashboardSummary(CancellationToken cancellationToken)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var result = await _agentFollowUpService.GetAgentDashboardSummaryAsync(organizationId.Value, cancellationToken);
            return Ok(result);
        }

        [HttpGet("agents/collections-history")]
        public async Task<IActionResult> GetCollectionsHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 20,
            CancellationToken cancellationToken = default)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });
            var result = await _agentFollowUpService.GetCollectionsHistoryAsync(organizationId.Value, page, pageSize, cancellationToken);
            return Ok(result);
        }

        [HttpPost("agents/force-followup/{leaseId:long}")]
        public Task<IActionResult> ForceFollowUp(long leaseId, [FromBody] ForceFollowUpRequest? request, CancellationToken cancellationToken)
        {
            _ = leaseId;
            _ = request;
            _ = cancellationToken;
            var policy = PercyActionPolicy.Evaluate(PercyActionTypes.CollectionsForceFollowUp);
            IActionResult result = StatusCode(StatusCodes.Status409Conflict, new
            {
                code = PercyActionErrorCodes.Unavailable,
                actionType = policy.ActionType,
                confirmationRequired = policy.ConfirmationRequired,
                executionEnabled = policy.ExecutionEnabled,
                message = "No follow-up was sent. This action requires organization-scoped Percy confirmation execution, which is not enabled yet."
            });
            return Task.FromResult(result);
        }

        public class ForceFollowUpRequest
        {
            public List<long>? TenantIds { get; set; }
        }

        private async Task<(long? OrganizationId, long? UserId)> GetPercyContextAsync()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue
                || !HttpContext.Items.TryGetValue("UserId", out var middlewareUserValue)
                || middlewareUserValue is not long middlewareUserId
                || middlewareUserId <= 0)
            {
                return (null, null);
            }

            var claimedUserId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!claimedUserId.HasValue || claimedUserId.Value != middlewareUserId)
                return (null, null);

            var databaseUser = await _userRepository.GetUser(middlewareUserId);
            if (databaseUser == null
                || databaseUser.Id != middlewareUserId
                || databaseUser.IsDeleted
                || databaseUser.IsSuspended)
            {
                return (null, null);
            }

            var member = await _organizationMemberRepository.GetMemberAsync(organizationId.Value, middlewareUserId);
            return member is { IsActive: true }
                ? (organizationId, middlewareUserId)
                : (null, null);
        }

        private IActionResult PercyResult<T>(ServiceResponse<T> response) =>
            response.Success ? Ok(response) : StatusCode(response.StatusCode, new { response.Message, response.Errors });
    }
}
