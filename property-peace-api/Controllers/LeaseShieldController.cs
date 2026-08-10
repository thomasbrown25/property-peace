using brownstone_hub_api.Dtos.LeaseShield;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Enforcement;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Services.LeaseShieldService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/lease-shield")]
    [Authorize(Roles = "Landlord,Admin,Tenant")]
    public class LeaseShieldController(
        ILeaseShieldService leaseShieldService,
        IEntitlementDecisionService entitlementDecisionService,
        IEntitlementResourceOrganizationResolver resourceOrganizationResolver,
        ILogger<LeaseShieldController> logger) : ControllerBase
    {
        private readonly ILeaseShieldService _leaseShieldService = leaseShieldService;
        private readonly IEntitlementDecisionService _entitlementDecisionService = entitlementDecisionService;
        private readonly IEntitlementResourceOrganizationResolver _resourceOrganizationResolver = resourceOrganizationResolver;
        private readonly ILogger<LeaseShieldController> _logger = logger;

        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations(CancellationToken cancellationToken)
        {
            var scope = TrustedScope(FeatureKeys.LeaseShieldRead);
            if (scope.Denial != null) return scope.Denial;
            var denial = await RequireAccessAsync(FeatureKeys.LeaseShieldRead, scope.UserId, scope.OrganizationId, null, cancellationToken);
            if (denial != null) return denial;

            var response = await _leaseShieldService.GetConversationsAsync(scope.UserId, scope.OrganizationId, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("conversations/{id:long}")]
        public async Task<IActionResult> GetConversation(long id, CancellationToken cancellationToken)
        {
            var scope = TrustedScope(FeatureKeys.LeaseShieldRead);
            if (scope.Denial != null) return scope.Denial;
            var resource = await ConversationOrganizationAsync(id, scope.UserId, cancellationToken);
            if (!resource.HasValue) return ConversationNotFound();
            var denial = await RequireAccessAsync(FeatureKeys.LeaseShieldRead, scope.UserId, scope.OrganizationId, resource, cancellationToken);
            if (denial != null) return denial;

            var response = await _leaseShieldService.GetConversationAsync(id, scope.UserId, scope.OrganizationId, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("conversations")]
        public async Task<IActionResult> CreateConversation([FromBody] CreateLeaseShieldConversationRequest request, CancellationToken cancellationToken)
        {
            var scope = TrustedScope(FeatureKeys.LeaseShieldManage);
            if (scope.Denial != null) return scope.Denial;
            var denial = await RequireAccessAsync(FeatureKeys.LeaseShieldManage, scope.UserId, scope.OrganizationId, null, cancellationToken);
            if (denial != null) return denial;

            var response = await _leaseShieldService.CreateConversationAsync(scope.UserId, request, scope.OrganizationId, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("conversations/{id:long}")]
        public async Task<IActionResult> UpdateConversation(long id, [FromBody] UpdateLeaseShieldConversationRequest request, CancellationToken cancellationToken)
        {
            var scope = TrustedScope(FeatureKeys.LeaseShieldManage);
            if (scope.Denial != null) return scope.Denial;
            var resource = await ConversationOrganizationAsync(id, scope.UserId, cancellationToken);
            if (!resource.HasValue) return ConversationNotFound();
            var denial = await RequireAccessAsync(FeatureKeys.LeaseShieldManage, scope.UserId, scope.OrganizationId, resource, cancellationToken);
            if (denial != null) return denial;

            var response = await _leaseShieldService.UpdateConversationTitleAsync(id, scope.UserId, scope.OrganizationId, request, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("conversations/{id:long}")]
        public async Task<IActionResult> DeleteConversation(long id, CancellationToken cancellationToken)
        {
            var scope = TrustedScope(FeatureKeys.LeaseShieldManage);
            if (scope.Denial != null) return scope.Denial;
            var resource = await ConversationOrganizationAsync(id, scope.UserId, cancellationToken);
            if (!resource.HasValue) return ConversationNotFound();
            var denial = await RequireAccessAsync(FeatureKeys.LeaseShieldManage, scope.UserId, scope.OrganizationId, resource, cancellationToken);
            if (denial != null) return denial;

            var response = await _leaseShieldService.DeleteConversationAsync(id, scope.UserId, scope.OrganizationId, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("conversations/{id:long}/messages")]
        public async Task<IActionResult> SendMessage(long id, [FromBody] SendLeaseShieldMessageRequest request, CancellationToken cancellationToken)
        {
            var scope = TrustedScope(FeatureKeys.LeaseShieldManage);
            if (scope.Denial != null) return scope.Denial;
            var resource = await ConversationOrganizationAsync(id, scope.UserId, cancellationToken);
            if (!resource.HasValue) return ConversationNotFound();
            var denial = await RequireAccessAsync(FeatureKeys.LeaseShieldManage, scope.UserId, scope.OrganizationId, resource, cancellationToken);
            if (denial != null) return denial;

            var response = await _leaseShieldService.SendMessageAsync(id, scope.UserId, request, scope.OrganizationId, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("messages")]
        public async Task<IActionResult> SendMessageNewConversation([FromBody] SendLeaseShieldMessageRequest request, CancellationToken cancellationToken)
        {
            var scope = TrustedScope(FeatureKeys.LeaseShieldManage);
            if (scope.Denial != null) return scope.Denial;
            var denial = await RequireAccessAsync(FeatureKeys.LeaseShieldManage, scope.UserId, scope.OrganizationId, null, cancellationToken);
            if (denial != null) return denial;

            var response = await _leaseShieldService.SendMessageAsync(null, scope.UserId, request, scope.OrganizationId, cancellationToken);
            if (!response.Success) return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        private async Task<IActionResult?> RequireAccessAsync(
            FeatureKey feature,
            long userId,
            long organizationId,
            long? resourceOrganizationId,
            CancellationToken cancellationToken)
        {
            var decision = await _entitlementDecisionService.DecideAsync(
                EntitlementEnforcement.Request(
                    userId,
                    organizationId,
                    feature,
                    resourceOrganizationId),
                cancellationToken);
            return EntitlementEnforcement.IsAllowed(feature, decision)
                ? null
                : EntitlementEnforcement.Denied(feature, decision);
        }

        private Task<long?> ConversationOrganizationAsync(long id, long userId, CancellationToken cancellationToken) =>
            _resourceOrganizationResolver.GetLeaseShieldConversationOrganizationIdAsync(id, userId, cancellationToken);

        private (long UserId, long OrganizationId, IActionResult? Denial) TrustedScope(FeatureKey feature)
        {
            var userId = HttpContext.Items["UserId"] switch
            {
                long value when value > 0 => value,
                int value when value > 0 => value,
                _ => 0
            };
            var organizationId = HttpContext.Items["OrganizationId"] switch
            {
                long value when value > 0 => value,
                int value when value > 0 => value,
                _ => 0
            };

            if (userId <= 0) return (0, organizationId, EntitlementEnforcement.MissingUser(feature));
            if (organizationId <= 0) return (userId, 0, EntitlementEnforcement.MissingOrganization(feature));
            return (userId, organizationId, null);
        }

        private static ObjectResult ConversationNotFound() =>
            new(new { success = false, message = "Conversation not found." }) { StatusCode = StatusCodes.Status404NotFound };
    }
}
