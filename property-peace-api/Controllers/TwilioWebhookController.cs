using brownstone_hub_api.Services.SmsService;
using brownstone_hub_api.Repositories.OrganizationSmsNumbers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Twilio.Security;
using brownstone_hub_api.Services.MessageDeliveries;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/webhook/twilio")]
    [AllowAnonymous]
    public class TwilioWebhookController(
        IInboundSmsService inboundSmsService,
        IOrganizationSmsNumberRepository organizationSmsNumberRepository,
        IMessageDeliveryService messageDeliveryService,
        IConfiguration configuration,
        ILogger<TwilioWebhookController> logger) : ControllerBase
    {
        private readonly IInboundSmsService _inboundSmsService = inboundSmsService;
        private readonly IOrganizationSmsNumberRepository _organizationSmsNumberRepository = organizationSmsNumberRepository;
        private readonly IMessageDeliveryService _messageDeliveryService = messageDeliveryService;
        private readonly IConfiguration _configuration = configuration;
        private readonly ILogger<TwilioWebhookController> _logger = logger;

        [HttpPost("inbound-sms")]
        public async Task<IActionResult> InboundSms()
        {
            // Validate Twilio signature to ensure this request is genuinely from Twilio
            if (!ValidateTwilioSignature())
            {
                _logger.LogWarning("Rejected inbound SMS webhook — invalid Twilio signature");
                return Forbid();
            }

            var from = Request.Form["From"].ToString();
            var to = Request.Form["To"].ToString();
            var body = Request.Form["Body"].ToString();
            var messageSid = Request.Form["MessageSid"].ToString();

            if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to) || string.IsNullOrWhiteSpace(body) || string.IsNullOrWhiteSpace(messageSid))
            {
                _logger.LogWarning("Inbound SMS webhook received with missing From, To, Body, or MessageSid");
                return BadRequest();
            }

            _logger.LogInformation("Authenticated inbound SMS received, length {Length}", body.Length);

            var twiml = await _inboundSmsService.HandleInboundAsync(from, to, body, messageSid);

            return Content(twiml, "application/xml");
        }

        [HttpPost("number-status")]
        public async Task<IActionResult> NumberStatus()
        {
            if (!ValidateTwilioSignature())
            {
                _logger.LogWarning("Rejected Twilio number status webhook — invalid signature");
                return Forbid();
            }

            var sid = Request.Form["IncomingPhoneNumberSid"].ToString();
            if (string.IsNullOrWhiteSpace(sid))
            {
                sid = Request.Form["PhoneNumberSid"].ToString();
            }

            var status = Request.Form["Status"].ToString();
            if (string.IsNullOrWhiteSpace(status))
            {
                status = Request.Form["PhoneNumberStatus"].ToString();
            }

            if (string.IsNullOrWhiteSpace(sid) || string.IsNullOrWhiteSpace(status))
            {
                _logger.LogWarning("Twilio number status webhook received without sid/status");
                return BadRequest();
            }

            var number = await _organizationSmsNumberRepository.GetByTwilioPhoneNumberSidAsync(sid);
            if (number == null)
            {
                _logger.LogWarning("Twilio number status webhook for unknown SID {Sid}", sid);
                return Ok();
            }

            number.Status = status;
            number.IsActive = !status.Equals("released", StringComparison.OrdinalIgnoreCase) && !status.Equals("failed", StringComparison.OrdinalIgnoreCase);
            if (!number.IsActive && number.ReleasedAt == null)
            {
                number.ReleasedAt = DateTime.UtcNow;
            }

            await _organizationSmsNumberRepository.UpdateAsync(number);
            _logger.LogInformation("Updated organization SMS number {Id} SID {Sid} status to {Status}", number.Id, sid, status);
            return Ok();
        }

        [HttpPost("message-status")]
        public async Task<IActionResult> MessageStatus(CancellationToken cancellationToken)
        {
            if (!ValidateTwilioSignature()) return Forbid();
            var sid = Request.Form["MessageSid"].ToString();
            var status = Request.Form["MessageStatus"].ToString();
            if (string.IsNullOrWhiteSpace(sid) || string.IsNullOrWhiteSpace(status)) return BadRequest();

            await _messageDeliveryService.RecordProviderStatusAsync("twilio", sid, status,
                Request.Form["ErrorCode"].ToString(), Request.Form["ErrorMessage"].ToString(), cancellationToken);
            return Ok();
        }

        private bool ValidateTwilioSignature()
        {
            try
            {
                var authToken = _configuration["Twilio:AuthToken"];
                if (string.IsNullOrEmpty(authToken))
                {
                    _logger.LogError("Twilio AuthToken not configured — skipping signature validation");
                    return false;
                }

                var validator = new RequestValidator(authToken);

                var signature = Request.Headers["X-Twilio-Signature"].ToString();
                if (string.IsNullOrEmpty(signature))
                    return false;

                // Build the full URL Twilio signed
                var url = $"{Request.Scheme}://{Request.Host}{Request.Path}";

                var parameters = Request.Form.ToDictionary(
                    kvp => kvp.Key,
                    kvp => kvp.Value.ToString());

                return validator.Validate(url, parameters, signature);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating Twilio signature");
                return false;
            }
        }
    }
}
