using brownstone_hub_api.Helpers;
using brownstone_hub_api.Services.AICopilotService;
using brownstone_hub_api.Services.AgentFollowUpService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/ai-copilot")]
    [Authorize(Roles = "Landlord,Admin")]
    public class AICopilotController(
        IAICopilotService aiCopilotService,
        IAgentFollowUpService agentFollowUpService,
        ILogger<AICopilotController> logger) : ControllerBase
    {
        private readonly IAICopilotService _aiCopilotService = aiCopilotService;
        private readonly IAgentFollowUpService _agentFollowUpService = agentFollowUpService;
        private readonly ILogger<AICopilotController> _logger = logger;

        [Authorize]
        [HttpGet("organization-summary")]
        public async Task<IActionResult> GetOrganizationSummary()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var response = await _aiCopilotService.GetOrganizationSummary(organizationId.Value);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        /// <summary>
        /// Manually trigger the overdue rent AI follow-up agent sweep.
        /// Awaits completion and returns a structured summary of what was reviewed and acted on.
        /// </summary>
        [HttpPost("agents/overdue-rent-sweep")]
        public async Task<IActionResult> TriggerOverdueRentSweep(CancellationToken cancellationToken)
        {
            try
            {
                var result = await _agentFollowUpService.RunOverdueRentSweepAsync(cancellationToken);
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Manual overdue rent sweep failed");
                return StatusCode(500, new { message = "The sweep encountered an error. Check server logs for details." });
            }
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
        public async Task<IActionResult> GetCollectionsHistory(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken cancellationToken = default)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            var result = await _agentFollowUpService.GetCollectionsHistoryAsync(
                organizationId.Value, page, pageSize, cancellationToken);

            return Ok(result);
        }

        [HttpPost("agents/force-followup/{leaseId:long}")]
        public async Task<IActionResult> ForceFollowUp(long leaseId, [FromBody] ForceFollowUpRequest? request, CancellationToken cancellationToken)
        {
            try
            {
                var sentCount = await _agentFollowUpService.ForceFollowUpForLeaseAsync(leaseId, request?.TenantIds, cancellationToken);
                if (sentCount == 0)
                    return StatusCode(500, new { message = "Failed to send follow-up. Check server logs." });
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
    }
}

