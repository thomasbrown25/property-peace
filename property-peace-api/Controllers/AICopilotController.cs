using brownstone_hub_api.Helpers;
using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Services.AICopilotService;
using brownstone_hub_api.Services.AgentFollowUpService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/ai-copilot")]
    [Authorize(Roles = "Landlord,Admin")]
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

            await WriteEventAsync(new { type = "status", message = "Understanding your request" });
            await WriteEventAsync(new { type = "status", message = "Checking Property Peace data" });

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
        public async Task<IActionResult> ArchiveConversation(long conversationId, CancellationToken cancellationToken)
        {
            var context = await GetPercyContextAsync();
            if (!context.OrganizationId.HasValue) return StatusCode(403, new { Message = "Organization context is required" });
            if (!context.UserId.HasValue) return Unauthorized(new { Message = "Authenticated user context is required" });
            var response = await _aiCopilotService.ArchiveConversationAsync(context.OrganizationId.Value, context.UserId.Value, conversationId, cancellationToken);
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
        public async Task<IActionResult> ForceFollowUp(long leaseId, [FromBody] ForceFollowUpRequest? request, CancellationToken cancellationToken)
        {
            try
            {
                var sentCount = await _agentFollowUpService.ForceFollowUpForLeaseAsync(leaseId, request?.TenantIds, cancellationToken);
                if (sentCount == 0) return StatusCode(500, new { message = "Failed to send follow-up. Check server logs." });
                return Ok(new { success = true, sentCount });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Force follow-up failed for lease {LeaseId}", leaseId);
                return StatusCode(500, new { message = "Failed to send follow-up." });
            }
        }

        public class ForceFollowUpRequest
        {
            public List<long>? TenantIds { get; set; }
        }

        private async Task<(long? OrganizationId, long? UserId)> GetPercyContextAsync()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            var userId = await this.GetCurrentUserIdAsync(_userRepository);
            if (!organizationId.HasValue || !userId.HasValue)
                return (organizationId, userId);

            var member = await _organizationMemberRepository.GetMemberAsync(organizationId.Value, userId.Value);
            return member is { IsActive: true }
                ? (organizationId, userId)
                : (null, userId);
        }

        private IActionResult PercyResult<T>(ServiceResponse<T> response) =>
            response.Success ? Ok(response) : StatusCode(response.StatusCode, new { response.Message, response.Errors });
    }
}
