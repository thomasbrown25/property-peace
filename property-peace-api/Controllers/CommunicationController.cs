using brownstone_hub_api.Dtos.Sms;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.CommunicationService;
using brownstone_hub_api.Config;
using brownstone_hub_api.Entitlements.Enforcement;
using brownstone_hub_api.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Services.SmsService;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class CommunicationController : ControllerBase
    {
        private readonly ICommunicationService _communicationService;
        private readonly IOutboundSmsSecurityService _outboundSmsSecurity;
        private readonly ILogger<CommunicationController> _logger;

        public CommunicationController(
            ICommunicationService communicationService,
            IOutboundSmsSecurityService outboundSmsSecurity,
            ILogger<CommunicationController> logger)
        {
            _communicationService = communicationService;
            _outboundSmsSecurity = outboundSmsSecurity;
            _logger = logger;
        }

        /// <summary>
        /// Send an SMS message to a single recipient
        /// </summary>
        /// <param name="request">SMS request containing recipient phone number and message</param>
        /// <param name="cancellationToken">Cancellation token</param>
        /// <returns>Response indicating success or failure</returns>
        [HttpPost("sms/send")]
        [RequireEntitlement("sms-messaging")]
        [RequireFeatureReady(FeatureKeys.DedicatedSmsNumber)]
        public async Task<ActionResult<ServiceResponse<SendSmsResponseDto>>> SendSms(
            [FromBody] SendSmsDto request,
            CancellationToken cancellationToken = default)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new ServiceResponse<SendSmsResponseDto>
                {
                    Success = false,
                    Message = "Invalid request",
                    StatusCode = 400,
                    Errors = new Error
                    {
                        Message = "Validation failed",
                        Details = string.Join("; ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage))
                    }
                });
            }

            var sender = await ResolveSenderAsync(cancellationToken);
            if (!sender.IsAllowed || string.IsNullOrWhiteSpace(sender.From))
                return StatusCode(StatusCodes.Status403Forbidden,
                    ServiceResponse<SendSmsResponseDto>.CreateError("SMS sending is unavailable", sender.ReasonCode ?? "SMS authorization failed", statusCode: 403));
            var response = await _communicationService.SendSmsAsync(request, sender.From, cancellationToken);

            if (!response.Success)
            {
                return StatusCode(response.StatusCode, response);
            }

            return Ok(response);
        }

        /// <summary>
        /// Send an SMS message to multiple recipients
        /// </summary>
        /// <param name="request">Bulk SMS request containing recipient phone numbers and message</param>
        /// <param name="cancellationToken">Cancellation token</param>
        /// <returns>Response indicating success or failure with counts</returns>
        [HttpPost("sms/send-bulk")]
        [RequireEntitlement("sms-messaging")]
        [RequireFeatureReady(FeatureKeys.DedicatedSmsNumber)]
        public async Task<ActionResult<ServiceResponse<SendBulkSmsResponseDto>>> SendBulkSms(
            [FromBody] SendBulkSmsDto request,
            CancellationToken cancellationToken = default)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new ServiceResponse<SendBulkSmsResponseDto>
                {
                    Success = false,
                    Message = "Invalid request",
                    StatusCode = 400,
                    Errors = new Error
                    {
                        Message = "Validation failed",
                        Details = string.Join("; ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage))
                    }
                });
            }

            var sender = await ResolveSenderAsync(cancellationToken);
            if (!sender.IsAllowed || string.IsNullOrWhiteSpace(sender.From))
                return StatusCode(StatusCodes.Status403Forbidden,
                    ServiceResponse<SendBulkSmsResponseDto>.CreateError("SMS sending is unavailable", sender.ReasonCode ?? "SMS authorization failed", statusCode: 403));
            var response = await _communicationService.SendBulkSmsAsync(request, sender.From, cancellationToken);

            if (!response.Success)
            {
                return StatusCode(response.StatusCode, response);
            }

            return Ok(response);
        }

        private Task<OutboundSmsSecurityDecision> ResolveSenderAsync(CancellationToken cancellationToken)
        {
            if (!TryGetPositiveId(HttpContext.Items["UserId"], out var userId) ||
                !TryGetPositiveId(HttpContext.Items["OrganizationId"], out var organizationId))
                return Task.FromResult(OutboundSmsSecurityDecision.Denied("organization_scope_required"));
            return _outboundSmsSecurity.AuthorizeOrganizationSendAsync(userId, organizationId, cancellationToken);
        }

        private static bool TryGetPositiveId(object? value, out long id)
        {
            id = value switch { long longValue => longValue, int intValue => intValue, _ => 0 };
            return id > 0;
        }
    }
}

