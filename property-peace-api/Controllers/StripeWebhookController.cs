using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using brownstone_hub_api.Services.StripeService;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/stripe/webhook")]
    [AllowAnonymous] // Webhooks come from Stripe servers, not authenticated users
    public class StripeWebhookController : ControllerBase
    {
        private readonly IStripeWebhookService _webhookService;
        private readonly ILogger<StripeWebhookController> _logger;
        private readonly IConfiguration _configuration;
        private readonly DataContext _context;

        public StripeWebhookController(
            IStripeWebhookService webhookService,
            ILogger<StripeWebhookController> logger,
            IConfiguration configuration,
            DataContext context)
        {
            _webhookService = webhookService;
            _logger = logger;
            _configuration = configuration;
            _context = context;
        }

        /// <summary>
        /// Handle Stripe webhook events
        /// </summary>
        [HttpPost]
        [IgnoreAntiforgeryToken] // Webhooks don't use CSRF tokens
        public async Task<IActionResult> HandleWebhook()
        {
            // Log immediately when webhook endpoint is hit
            _logger.LogWarning("🔔🔔🔔 WEBHOOK ENDPOINT HIT! 🔔🔔🔔 Method: {Method}, ContentType: {ContentType}, Path: {Path}, Headers: {Headers}",
                Request.Method,
                Request.ContentType,
                Request.Path,
                string.Join(", ", Request.Headers.Select(h => $"{h.Key}={string.Join(";", h.Value.ToArray())}")));

            _logger.LogInformation("Webhook endpoint called. Method: {Method}, ContentType: {ContentType}",
                Request.Method, Request.ContentType);

            // Try to get webhook secret from configuration (Azure App Config or appsettings.json)
            var webhookSecret = _configuration["Stripe:WebhookSecret"];

            if (string.IsNullOrWhiteSpace(webhookSecret))
            {
                _logger.LogError("Webhook secret is not configured");
                return BadRequest(new { Message = "Webhook secret not configured" });
            }

            // Log that webhook secret was found (but don't log the actual secret)
            _logger.LogInformation("Webhook secret loaded successfully (length: {Length})", webhookSecret.Length);

            // Check for Stripe signature header
            var signatureHeader = Request.Headers["Stripe-Signature"].ToString();
            if (string.IsNullOrEmpty(signatureHeader))
            {
                _logger.LogError("Stripe-Signature header is missing");
                return BadRequest(new { Message = "Stripe-Signature header is missing" });
            }

            _logger.LogInformation("Stripe-Signature header present (length: {Length})", signatureHeader.Length);

            string json;
            try
            {
                // Read request body
                using var reader = new StreamReader(Request.Body, System.Text.Encoding.UTF8, leaveOpen: true);
                json = await reader.ReadToEndAsync();

                if (string.IsNullOrEmpty(json))
                {
                    _logger.LogError("Request body is empty");
                    return BadRequest(new { Message = "Request body is empty" });
                }

                _logger.LogInformation("Request body read successfully (length: {Length} chars)", json.Length);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading request body");
                return BadRequest(ServiceResponse<object>.CreateError(
                    "Error reading request body",
                    ex.Message,
                    ex.InnerException?.Message));
            }

            brownstone_hub_api.Models.StripeWebhookEvent? webhookEventLog = null;

            try
            {
                _logger.LogInformation("Attempting to construct Stripe event...");
                var stripeEvent = EventUtility.ConstructEvent(
                    json,
                    signatureHeader,
                    webhookSecret,
                    throwOnApiVersionMismatch: false // Allow different API versions (Stripe CLI uses older version)
                );

                _logger.LogInformation("Successfully received Stripe webhook event: {EventType}, ID: {EventId}, Created: {Created}",
                    stripeEvent.Type, stripeEvent.Id, stripeEvent.Created);

                webhookEventLog = await _context.StripeWebhookEvents
                    .FirstOrDefaultAsync(e => e.StripeEventId == stripeEvent.Id);

                if (webhookEventLog?.ProcessedAt != null)
                {
                    _logger.LogInformation("Stripe webhook event {EventId} was already processed at {ProcessedAt}; acknowledging duplicate delivery.", stripeEvent.Id, webhookEventLog.ProcessedAt);
                    return Ok(new { received = true, duplicate = true });
                }

                var payloadObjectId = GetStripePayloadObjectId(stripeEvent);

                if (webhookEventLog == null)
                {
                    webhookEventLog = new brownstone_hub_api.Models.StripeWebhookEvent
                    {
                        StripeEventId = stripeEvent.Id,
                        EventType = stripeEvent.Type,
                        PayloadObjectId = payloadObjectId,
                        Status = "Processing",
                        StripeCreatedAt = stripeEvent.Created,
                        ReceivedAt = DateTime.UtcNow
                    };
                    await _context.StripeWebhookEvents.AddAsync(webhookEventLog);
                }
                else
                {
                    webhookEventLog.EventType = stripeEvent.Type;
                    webhookEventLog.PayloadObjectId ??= payloadObjectId;
                    webhookEventLog.Status = "Processing";
                    webhookEventLog.ProcessingAttempts += 1;
                    webhookEventLog.LastError = null;
                    webhookEventLog.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();

                // Handle the event
                switch (stripeEvent.Type)
                {
                    case "customer.subscription.created":
                        _logger.LogInformation("Processing customer.subscription.created event");
                        await _webhookService.HandleSubscriptionCreatedAsync(stripeEvent);
                        break;
                    case "customer.subscription.updated":
                        _logger.LogInformation("Processing customer.subscription.updated event");
                        await _webhookService.HandleSubscriptionUpdatedAsync(stripeEvent);
                        break;
                    case "customer.subscription.deleted":
                        _logger.LogInformation("Processing customer.subscription.deleted event");
                        await _webhookService.HandleSubscriptionDeletedAsync(stripeEvent);
                        break;
                    case "invoice.payment_succeeded":
                        _logger.LogInformation("Processing invoice.payment_succeeded event");
                        await _webhookService.HandleInvoicePaymentSucceededAsync(stripeEvent);
                        break;
                    case "invoice.payment_failed":
                        _logger.LogInformation("Processing invoice.payment_failed event");
                        await _webhookService.HandleInvoicePaymentFailedAsync(stripeEvent);
                        break;
                    case "customer.subscription.trial_will_end":
                        _logger.LogInformation("Processing customer.subscription.trial_will_end event");
                        await _webhookService.HandleTrialWillEndAsync(stripeEvent);
                        break;
                    case "payment_intent.succeeded":
                        _logger.LogInformation("Processing payment_intent.succeeded event");
                        await _webhookService.HandlePaymentIntentSucceededAsync(stripeEvent);
                        break;
                    case "payment_intent.processing":
                        _logger.LogInformation("Processing payment_intent.processing event");
                        await _webhookService.HandlePaymentIntentProcessingAsync(stripeEvent);
                        break;
                    case "payment_intent.payment_failed":
                        _logger.LogInformation("Processing payment_intent.payment_failed event");
                        await _webhookService.HandlePaymentIntentPaymentFailedAsync(stripeEvent);
                        break;
                    case "payment_intent.canceled":
                        _logger.LogInformation("Processing payment_intent.canceled event");
                        await _webhookService.HandlePaymentIntentCanceledAsync(stripeEvent);
                        break;
                    case "charge.dispute.created":
                        _logger.LogInformation("Processing charge.dispute.created event");
                        await _webhookService.HandleChargeDisputeCreatedAsync(stripeEvent);
                        break;
                    default:
                        _logger.LogInformation("Unhandled event type: {EventType}", stripeEvent.Type);
                        break;
                }

                webhookEventLog.Status = "Processed";
                webhookEventLog.ProcessedAt = DateTime.UtcNow;
                webhookEventLog.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                _logger.LogWarning("✅✅✅ WEBHOOK PROCESSED SUCCESSFULLY! ✅✅✅ EventType: {EventType}, EventId: {EventId}",
                    stripeEvent.Type, stripeEvent.Id);
                _logger.LogInformation("Webhook processed successfully for event {EventType}", stripeEvent.Type);
                return Ok(new { received = true });
            }
            catch (StripeException ex)
            {
                _logger.LogError("❌❌❌ STRIPE WEBHOOK ERROR! ❌❌❌ Error Type: {ErrorType}, Error Code: {ErrorCode}, Message: {Message}",
                    ex.GetType().Name, ex.StripeError?.Code, ex.Message);
                _logger.LogError(ex, "Stripe webhook error. Error Type: {ErrorType}, Error Code: {ErrorCode}, Message: {Message}",
                    ex.GetType().Name, ex.StripeError?.Code, ex.Message);
                await MarkWebhookEventFailedAsync(webhookEventLog, ex);
                return BadRequest(ServiceResponse<object>.CreateError(
                    "Webhook error",
                    ex.Message,
                    ex.StripeError?.Code));
            }
            catch (Exception ex)
            {
                _logger.LogError("❌❌❌ WEBHOOK PROCESSING ERROR! ❌❌❌ Exception Type: {ExceptionType}, Message: {Message}",
                    ex.GetType().Name, ex.Message);
                _logger.LogError(ex, "Error processing webhook. Exception Type: {ExceptionType}, Message: {Message}, StackTrace: {StackTrace}",
                    ex.GetType().Name, ex.Message, ex.StackTrace);
                await MarkWebhookEventFailedAsync(webhookEventLog, ex);
                return StatusCode(500, ServiceResponse<object>.CreateError(
                    "Error processing webhook",
                    ex.Message,
                    ex.InnerException?.Message,
                    500));
            }
        }

        private static string? GetStripePayloadObjectId(Event stripeEvent)
        {
            var payloadObject = stripeEvent.Data?.Object;
            return payloadObject?.GetType().GetProperty("Id")?.GetValue(payloadObject)?.ToString();
        }

        private async Task MarkWebhookEventFailedAsync(brownstone_hub_api.Models.StripeWebhookEvent? webhookEventLog, Exception ex)
        {
            if (webhookEventLog == null)
            {
                return;
            }

            try
            {
                webhookEventLog.Status = "Failed";
                webhookEventLog.FailedAt = DateTime.UtcNow;
                webhookEventLog.UpdatedAt = DateTime.UtcNow;
                webhookEventLog.LastError = ex.Message.Length <= 2000 ? ex.Message : ex.Message[..2000];
                await _context.SaveChangesAsync();
            }
            catch (Exception logEx)
            {
                _logger.LogError(logEx, "Failed to update Stripe webhook event failure status for {StripeEventId}", webhookEventLog.StripeEventId);
            }
        }

        /// <summary>
        /// Test endpoint to verify webhook URL is accessible
        /// </summary>
        [HttpGet("test")]
        public IActionResult TestWebhookEndpoint()
        {
            _logger.LogWarning("🧪 WEBHOOK TEST ENDPOINT CALLED - This confirms the webhook URL is accessible!");
            return Ok(new {
                message = "Webhook endpoint is accessible!",
                timestamp = DateTime.UtcNow,
                endpoint = "/api/stripe/webhook",
                baseUrl = $"{Request.Scheme}://{Request.Host}",
                fullUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}/api/stripe/webhook",
                note = "This is a test endpoint. The actual webhook endpoint is POST /api/stripe/webhook"
            });
        }

        /// <summary>
        /// Health check endpoint for webhook (can be used by Stripe to verify connectivity)
        /// </summary>
        [HttpGet]
        [HttpHead]
        public IActionResult WebhookHealthCheck()
        {
            _logger.LogInformation("🏥 Webhook health check called from {RemoteIp}", Request.HttpContext.Connection.RemoteIpAddress);
            return Ok(new {
                status = "healthy",
                endpoint = "/api/stripe/webhook",
                timestamp = DateTime.UtcNow
            });
        }

    }
}

