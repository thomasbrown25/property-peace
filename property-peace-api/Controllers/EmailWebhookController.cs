using brownstone_hub_api.Services.EmailSyncService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/webhook/email")]
    [AllowAnonymous]
    public class EmailWebhookController(
        IInboundEmailService inboundEmailService,
        IConfiguration configuration,
        ILogger<EmailWebhookController> logger) : ControllerBase
    {
        private readonly IInboundEmailService _inboundEmailService = inboundEmailService;
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
            if (string.IsNullOrWhiteSpace(payload.From) || string.IsNullOrWhiteSpace(payload.To))
            {
                _logger.LogWarning("Inbound email webhook received without From or To");
                return BadRequest(new { success = false, message = "from and to are required" });
            }

            var handled = await _inboundEmailService.HandleInboundAsync(
                payload.From,
                payload.To,
                payload.Subject,
                payload.Text,
                payload.Html,
                cancellationToken);

            return Ok(new { success = handled });
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
            if (string.IsNullOrWhiteSpace(provided))
                provided = Request.Query["secret"].ToString();

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
                    Html = First(form["html"], form["Html"], form["body-html"], form["stripped-html"])
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
        }
    }
}
