using brownstone_hub_api.Services.EmailSyncService;
using brownstone_hub_api.Services.MessageDeliveries;
using brownstone_hub_api.Repositories.Timelines;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/webhook/email")]
    [AllowAnonymous]
    public class EmailWebhookController(
        IInboundEmailService inboundEmailService,
        IMessageDeliveryService messageDeliveryService,
        IConfiguration configuration,
        ILogger<EmailWebhookController> logger) : ControllerBase
    {
        private readonly IInboundEmailService _inboundEmailService = inboundEmailService;
        private readonly IMessageDeliveryService _messageDeliveryService = messageDeliveryService;
        private readonly IConfiguration _configuration = configuration;
        private readonly ILogger<EmailWebhookController> _logger = logger;

        [HttpPost("inbound")]
        public async Task<IActionResult> Inbound(CancellationToken cancellationToken)
        {
            if (!ValidateSharedSecret())
            {
                _logger.LogWarning("Rejected inbound email webhook — invalid or missing shared secret");
                return Forbid();
            }

            var payload = await ReadPayloadAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(payload.From) || string.IsNullOrWhiteSpace(payload.To) ||
                string.IsNullOrWhiteSpace(payload.EventId) || payload.EventId.Length > 160)
            {
                _logger.LogWarning("Inbound email webhook received without required routing fields or provider event ID");
                return BadRequest(new { success = false, message = "from, to, and a bounded provider event ID are required" });
            }

            try
            {
                var handled = await _inboundEmailService.HandleInboundAsync(
                    payload.From, payload.To, payload.Subject, payload.Text, payload.Html,
                    payload.EventId.Trim(), cancellationToken);

                return Ok(new { success = handled });
            }
            catch (TimelineIdempotencyConflictException)
            {
                return Conflict(new { success = false, message = "provider event ID conflicts with a prior payload" });
            }
        }

        [HttpPost("delivery-status")]
        public async Task<IActionResult> DeliveryStatus([FromBody] EmailDeliveryStatusPayload payload, CancellationToken cancellationToken)
        {
            if (!ValidateSharedSecret()) return Forbid();
            if (string.IsNullOrWhiteSpace(payload.ProviderMessageId) || string.IsNullOrWhiteSpace(payload.Status))
                return BadRequest(new { success = false });
            var handled = await _messageDeliveryService.RecordProviderStatusAsync(
                string.IsNullOrWhiteSpace(payload.Provider) ? "azure-email" : payload.Provider,
                payload.ProviderMessageId, payload.Status, payload.ErrorCode, payload.ErrorDetail, cancellationToken);
            return Ok(new { success = true, handled });
        }

        private bool ValidateSharedSecret()
        {
            var expected = _configuration["EmailWebhooks:SharedSecret"];
            if (string.IsNullOrWhiteSpace(expected))
            {
                _logger.LogError("EmailWebhooks:SharedSecret is not configured; inbound email sync is disabled");
                return false;
            }

            var provided = Request.Headers["X-PropertyPeace-Webhook-Secret"].ToString();
            return string.Equals(provided, expected, StringComparison.Ordinal);
        }

        private async Task<InboundEmailPayload> ReadPayloadAsync(CancellationToken cancellationToken)
        {
            if (Request.HasFormContentType)
            {
                var form = await Request.ReadFormAsync(cancellationToken);
                return new InboundEmailPayload
                {
                    From = First(form["from"], form["From"], form["sender"], form["Sender"]),
                    To = First(form["to"], form["To"], form["recipient"], form["Recipient"], form["envelope"], form["Envelope"]),
                    Subject = First(form["subject"], form["Subject"]),
                    Text = First(form["text"], form["Text"], form["body-plain"], form["Body"], form["stripped-text"]),
                    Html = First(form["html"], form["Html"], form["body-html"], form["stripped-html"]),
                    EventId = First(form["eventId"], form["EventId"], form["messageId"], form["MessageId"],
                        form["message-id"], form["Message-Id"])
                };
            }

            var jsonPayload = await Request.ReadFromJsonAsync<InboundEmailPayload>(cancellationToken: cancellationToken);
            return jsonPayload ?? new InboundEmailPayload();
        }

        private static string? First(params Microsoft.Extensions.Primitives.StringValues[] values)
        {
            foreach (var value in values)
            {
                var text = value.ToString();
                if (!string.IsNullOrWhiteSpace(text)) return text;
            }

            return null;
        }

        public class InboundEmailPayload
        {
            public string? From { get; set; }
            public string? To { get; set; }
            public string? Subject { get; set; }
            public string? Text { get; set; }
            public string? Html { get; set; }
            public string? EventId { get; set; }
        }

        public sealed class EmailDeliveryStatusPayload
        {
            public string? Provider { get; set; }
            public string? ProviderMessageId { get; set; }
            public string? Status { get; set; }
            public string? ErrorCode { get; set; }
            public string? ErrorDetail { get; set; }
        }
    }
}
