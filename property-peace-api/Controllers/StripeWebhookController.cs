using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/stripe/webhook")]
    [AllowAnonymous]
    public class StripeWebhookController : ControllerBase
    {
        private static readonly object InMemoryDispatchFenceGate = new();
        private static readonly Dictionary<string, DispatchFenceEntry> InMemoryDispatchFences = new();

        private readonly IStripeWebhookService _webhookService;
        private readonly ILogger<StripeWebhookController> _logger;
        private readonly IConfiguration _configuration;
        private readonly DataContext _context;
        private readonly IServiceScopeFactory? _scopeFactory;
        private readonly TimeProvider _timeProvider;
        private readonly TimeSpan _processingLeaseDuration;
        private readonly TimeSpan _heartbeatInterval;

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
            _timeProvider = TimeProvider.System;
            _processingLeaseDuration = TimeSpan.FromMinutes(15);
            _heartbeatInterval = TimeSpan.FromMinutes(5);
        }

        public StripeWebhookController(
            IStripeWebhookService webhookService,
            ILogger<StripeWebhookController> logger,
            IConfiguration configuration,
            DataContext context,
            IServiceScopeFactory scopeFactory,
            TimeProvider timeProvider,
            StripeWebhookLeaseOptions leaseOptions)
            : this(webhookService, logger, configuration, context)
        {
            ArgumentNullException.ThrowIfNull(scopeFactory);
            ArgumentNullException.ThrowIfNull(timeProvider);
            ArgumentNullException.ThrowIfNull(leaseOptions);
            if (leaseOptions.LeaseDuration <= TimeSpan.Zero)
                throw new ArgumentOutOfRangeException(nameof(leaseOptions), "Lease duration must be positive.");
            if (leaseOptions.HeartbeatInterval <= TimeSpan.Zero ||
                leaseOptions.HeartbeatInterval >= leaseOptions.LeaseDuration)
                throw new ArgumentOutOfRangeException(nameof(leaseOptions),
                    "Heartbeat interval must be positive and shorter than the lease duration.");

            _scopeFactory = scopeFactory;
            _timeProvider = timeProvider;
            _processingLeaseDuration = leaseOptions.LeaseDuration;
            _heartbeatInterval = leaseOptions.HeartbeatInterval;
        }

        [HttpPost]
        [IgnoreAntiforgeryToken]
        public async Task<IActionResult> HandleWebhook()
        {
            _logger.LogInformation("Webhook endpoint called. Method: {Method}, ContentType: {ContentType}",
                Request.Method, Request.ContentType);

            var webhookSecret = _configuration["Stripe:WebhookSecret"];
            if (string.IsNullOrWhiteSpace(webhookSecret))
            {
                _logger.LogError("Webhook secret is not configured");
                return BadRequest(new { Message = "Webhook secret not configured" });
            }

            _logger.LogInformation("Webhook secret loaded successfully (length: {Length})", webhookSecret.Length);

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
                    "Error reading request body", ex.Message, ex.InnerException?.Message));
            }

            string? claimedEventId = null;
            Guid? processingLeaseId = null;

            try
            {
                var stripeEvent = EventUtility.ConstructEvent(
                    json, signatureHeader, webhookSecret, throwOnApiVersionMismatch: false);

                _logger.LogInformation("Successfully received Stripe webhook event: {EventType}, ID: {EventId}, Created: {Created}",
                    stripeEvent.Type, stripeEvent.Id, stripeEvent.Created);

                var dispatchFence = await TryAcquireDispatchFenceAsync(stripeEvent.Id);
                if (dispatchFence == null)
                {
                    _logger.LogInformation("Stripe webhook event {EventId} has a live dispatch owner; requesting a later retry.", stripeEvent.Id);
                    return StatusCode(StatusCodes.Status409Conflict, new { received = false, processing = true });
                }

                await using (dispatchFence)
                {
                    var claim = await TryClaimWebhookEventAsync(stripeEvent, GetStripePayloadObjectId(stripeEvent));
                    if (claim.Status == WebhookClaimStatus.Processed)
                    {
                        _logger.LogInformation("Stripe webhook event {EventId} was already processed; acknowledging duplicate delivery.", stripeEvent.Id);
                        return Ok(new { received = true, duplicate = true });
                    }

                    if (claim.Status == WebhookClaimStatus.InProgress)
                    {
                        _logger.LogInformation("Stripe webhook event {EventId} is already being processed; requesting a later retry.", stripeEvent.Id);
                        return StatusCode(StatusCodes.Status409Conflict, new { received = false, processing = true });
                    }

                    claimedEventId = stripeEvent.Id;
                    processingLeaseId = claim.LeaseId;

                    await DispatchEventWithLeaseHeartbeatAsync(stripeEvent, claimedEventId, processingLeaseId!.Value);
                    await MarkWebhookEventProcessedAsync(claimedEventId, processingLeaseId.Value);

                    _logger.LogInformation("Webhook processed successfully for event {EventType}, ID: {EventId}",
                        stripeEvent.Type, stripeEvent.Id);
                    return Ok(new { received = true });
                }
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe webhook error. Error Type: {ErrorType}, Error Code: {ErrorCode}, Message: {Message}",
                    ex.GetType().Name, ex.StripeError?.Code, ex.Message);
                await MarkWebhookEventFailedAsync(claimedEventId, processingLeaseId, ex);
                return BadRequest(ServiceResponse<object>.CreateError(
                    "Webhook error", ex.Message, ex.StripeError?.Code));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing webhook. Exception Type: {ExceptionType}, Message: {Message}",
                    ex.GetType().Name, ex.Message);
                await MarkWebhookEventFailedAsync(claimedEventId, processingLeaseId, ex);
                return StatusCode(500, ServiceResponse<object>.CreateError(
                    "Error processing webhook", ex.Message, ex.InnerException?.Message, 500));
            }
        }

        private async Task<IAsyncDisposable?> TryAcquireDispatchFenceAsync(string stripeEventId)
        {
            if (!_context.Database.IsRelational())
            {
                DispatchFenceEntry entry;
                lock (InMemoryDispatchFenceGate)
                {
                    if (!InMemoryDispatchFences.TryGetValue(stripeEventId, out entry!))
                    {
                        entry = new DispatchFenceEntry();
                        InMemoryDispatchFences[stripeEventId] = entry;
                    }
                    entry.ReferenceCount++;
                }

                if (await entry.Semaphore.WaitAsync(0))
                    return new SemaphoreDispatchFence(stripeEventId, entry);

                ReleaseDispatchFenceReference(stripeEventId, entry);
                return null;
            }

            if (!_context.Database.IsSqlServer())
                throw new InvalidOperationException("Stripe webhook dispatch fencing requires SQL Server session application locks.");

            var connectionString = _context.Database.GetConnectionString();
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new InvalidOperationException("Stripe webhook dispatch fencing requires a database connection string.");

            var resource = $"stripe-webhook-dispatch:{stripeEventId}";
            var connection = new SqlConnection(connectionString);
            await connection.OpenAsync(HttpContext.RequestAborted);
            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = "DECLARE @result int; EXEC @result = sys.sp_getapplock @Resource=@resource, @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=0; SELECT @result;";
                command.Parameters.AddWithValue("@resource", resource);
                var result = Convert.ToInt32(await command.ExecuteScalarAsync(HttpContext.RequestAborted));
                if (result < 0)
                {
                    await connection.DisposeAsync();
                    return null;
                }

                return new SqlDispatchFence(connection, resource, _logger);
            }
            catch
            {
                await connection.DisposeAsync();
                throw;
            }
        }

        private async Task DispatchEventWithLeaseHeartbeatAsync(Event stripeEvent, string stripeEventId, Guid leaseId)
        {
            // Older direct callers can keep using the compatible constructor. Runtime DI supplies a
            // scope factory so heartbeat database work never shares this controller's DbContext.
            if (_scopeFactory == null)
            {
                await DispatchEventAsync(stripeEvent);
                return;
            }

            using var heartbeatCancellation = new CancellationTokenSource();
            var heartbeatTask = RunLeaseHeartbeatAsync(stripeEventId, leaseId, heartbeatCancellation.Token);
            try
            {
                await DispatchEventAsync(stripeEvent);
            }
            finally
            {
                heartbeatCancellation.Cancel();
                try
                {
                    await heartbeatTask;
                }
                catch (OperationCanceledException) when (heartbeatCancellation.IsCancellationRequested)
                {
                    // Expected when dispatch completes or fails.
                }
            }
        }

        private async Task RunLeaseHeartbeatAsync(string stripeEventId, Guid leaseId,
            CancellationToken cancellationToken)
        {
            while (true)
            {
                await Task.Delay(_heartbeatInterval, _timeProvider, cancellationToken);
                try
                {
                    if (!await RenewProcessingLeaseAsync(stripeEventId, leaseId, cancellationToken))
                    {
                        _logger.LogWarning(
                            "Stopped Stripe webhook lease heartbeat for {StripeEventId}; lease {LeaseId} is no longer owned.",
                            stripeEventId, leaseId);
                        return;
                    }
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    // A transient database failure should not kill renewal permanently. Retry at the
                    // normal cadence; ownership-conditional updates prevent reviving a reclaimed lease.
                    _logger.LogError(ex,
                        "Failed to renew Stripe webhook processing lease {LeaseId} for {StripeEventId}.",
                        leaseId, stripeEventId);
                }
            }
        }

        private async Task<bool> RenewProcessingLeaseAsync(string stripeEventId, Guid leaseId,
            CancellationToken cancellationToken)
        {
            await using var scope = _scopeFactory!.CreateAsyncScope();
            var heartbeatContext = scope.ServiceProvider.GetRequiredService<DataContext>();
            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var leaseExpiresAt = now.Add(_processingLeaseDuration);

            if (heartbeatContext.Database.IsRelational())
            {
                var updated = await heartbeatContext.StripeWebhookEvents
                    .Where(e => e.StripeEventId == stripeEventId && e.Status == "Processing" &&
                        e.ProcessedAt == null && e.ProcessingLeaseId == leaseId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(e => e.ProcessingLeaseExpiresAt, leaseExpiresAt)
                        .SetProperty(e => e.UpdatedAt, now), cancellationToken);
                return updated == 1;
            }

            var entry = await heartbeatContext.StripeWebhookEvents.SingleOrDefaultAsync(e =>
                e.StripeEventId == stripeEventId && e.Status == "Processing" &&
                e.ProcessedAt == null && e.ProcessingLeaseId == leaseId, cancellationToken);
            if (entry == null) return false;

            entry.ProcessingLeaseExpiresAt = leaseExpiresAt;
            entry.UpdatedAt = now;
            await heartbeatContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        private async Task DispatchEventAsync(Event stripeEvent)
        {
            switch (stripeEvent.Type)
            {
                case "customer.subscription.created":
                    await _webhookService.HandleSubscriptionCreatedAsync(stripeEvent);
                    break;
                case "customer.subscription.updated":
                    await _webhookService.HandleSubscriptionUpdatedAsync(stripeEvent);
                    break;
                case "customer.subscription.deleted":
                    await _webhookService.HandleSubscriptionDeletedAsync(stripeEvent);
                    break;
                case "invoice.payment_succeeded":
                    await _webhookService.HandleInvoicePaymentSucceededAsync(stripeEvent);
                    break;
                case "invoice.payment_failed":
                    await _webhookService.HandleInvoicePaymentFailedAsync(stripeEvent);
                    break;
                case "customer.subscription.trial_will_end":
                    await _webhookService.HandleTrialWillEndAsync(stripeEvent);
                    break;
                case "payment_intent.succeeded":
                    await _webhookService.HandlePaymentIntentSucceededAsync(stripeEvent);
                    break;
                case "payment_intent.processing":
                    await _webhookService.HandlePaymentIntentProcessingAsync(stripeEvent);
                    break;
                case "payment_intent.payment_failed":
                    await _webhookService.HandlePaymentIntentPaymentFailedAsync(stripeEvent);
                    break;
                case "payment_intent.canceled":
                    await _webhookService.HandlePaymentIntentCanceledAsync(stripeEvent);
                    break;
                case "charge.dispute.created":
                    await _webhookService.HandleChargeDisputeCreatedAsync(stripeEvent);
                    break;
                case "charge.refunded":
                    await _webhookService.HandleChargeRefundedAsync(stripeEvent);
                    break;
                case "refund.created":
                case "refund.updated":
                    await _webhookService.HandleRefundCreatedAsync(stripeEvent);
                    break;
                case "account.updated":
                    await _webhookService.HandleAccountUpdatedAsync(stripeEvent);
                    break;
                case "account.external_account.created":
                case "account.external_account.updated":
                case "account.external_account.deleted":
                    await _webhookService.HandleExternalAccountChangedAsync(stripeEvent);
                    break;
                default:
                    _logger.LogInformation("Unhandled event type: {EventType}", stripeEvent.Type);
                    break;
            }
        }

        private async Task<WebhookClaim> TryClaimWebhookEventAsync(Event stripeEvent, string? payloadObjectId)
        {
            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var leaseId = Guid.NewGuid();
            var leaseExpiresAt = now.Add(_processingLeaseDuration);

            // EF's in-memory provider has neither unique-index enforcement nor ExecuteUpdate.
            // The request-lifetime dispatch fence already serializes this event transition.
            if (!_context.Database.IsRelational())
            {
                var existing = await _context.StripeWebhookEvents
                    .SingleOrDefaultAsync(e => e.StripeEventId == stripeEvent.Id);
                if (existing?.ProcessedAt != null)
                {
                    return new(WebhookClaimStatus.Processed, null);
                }

                if (existing != null && existing.Status == "Processing" && existing.ProcessingLeaseExpiresAt > now)
                {
                    return new(WebhookClaimStatus.InProgress, null);
                }

                if (existing == null)
                {
                    existing = CreateWebhookEvent(stripeEvent, payloadObjectId, now, leaseId, leaseExpiresAt);
                    await _context.StripeWebhookEvents.AddAsync(existing);
                }
                else
                {
                    ApplyClaim(existing, stripeEvent, payloadObjectId, now, leaseId, leaseExpiresAt);
                }

                await _context.SaveChangesAsync();
                return new(WebhookClaimStatus.Claimed, leaseId);
            }

            // A new delivery claims by inserting under the unique StripeEventId index.
            var candidate = CreateWebhookEvent(stripeEvent, payloadObjectId, now, leaseId, leaseExpiresAt);
            await _context.StripeWebhookEvents.AddAsync(candidate);
            try
            {
                await _context.SaveChangesAsync();
                _context.Entry(candidate).State = EntityState.Detached;
                return new(WebhookClaimStatus.Claimed, leaseId);
            }
            catch (DbUpdateException insertException)
            {
                _context.ChangeTracker.Clear();

                // Do not mask a non-unique insert failure as a duplicate delivery.
                if (!await _context.StripeWebhookEvents.AsNoTracking()
                        .AnyAsync(e => e.StripeEventId == stripeEvent.Id))
                {
                    throw new InvalidOperationException("Could not persist the Stripe webhook inbox event.", insertException);
                }
            }

            // One SQL UPDATE owns the retry transition. An active lease or a completed event cannot match.
            var updated = await _context.StripeWebhookEvents
                .Where(e => e.StripeEventId == stripeEvent.Id && e.ProcessedAt == null &&
                    (e.Status != "Processing" || e.ProcessingLeaseExpiresAt == null || e.ProcessingLeaseExpiresAt <= now))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(e => e.EventType, stripeEvent.Type)
                    .SetProperty(e => e.PayloadObjectId, e => e.PayloadObjectId ?? payloadObjectId)
                    .SetProperty(e => e.Status, "Processing")
                    .SetProperty(e => e.ProcessingAttempts, e => e.ProcessingAttempts + 1)
                    .SetProperty(e => e.ProcessingLeaseId, leaseId)
                    .SetProperty(e => e.ProcessingLeaseExpiresAt, leaseExpiresAt)
                    .SetProperty(e => e.LastError, (string?)null)
                    .SetProperty(e => e.FailedAt, (DateTime?)null)
                    .SetProperty(e => e.UpdatedAt, now));

            if (updated == 1)
            {
                return new(WebhookClaimStatus.Claimed, leaseId);
            }

            var processed = await _context.StripeWebhookEvents.AsNoTracking()
                .AnyAsync(e => e.StripeEventId == stripeEvent.Id && e.ProcessedAt != null);
            return new(processed ? WebhookClaimStatus.Processed : WebhookClaimStatus.InProgress, null);
        }

        private static brownstone_hub_api.Models.StripeWebhookEvent CreateWebhookEvent(
            Event stripeEvent, string? payloadObjectId, DateTime now, Guid leaseId, DateTime leaseExpiresAt) => new()
        {
            StripeEventId = stripeEvent.Id,
            EventType = stripeEvent.Type,
            PayloadObjectId = payloadObjectId,
            Status = "Processing",
            StripeCreatedAt = stripeEvent.Created,
            ReceivedAt = now,
            ProcessingLeaseId = leaseId,
            ProcessingLeaseExpiresAt = leaseExpiresAt
        };

        private static void ApplyClaim(brownstone_hub_api.Models.StripeWebhookEvent existing,
            Event stripeEvent, string? payloadObjectId, DateTime now, Guid leaseId, DateTime leaseExpiresAt)
        {
            existing.EventType = stripeEvent.Type;
            existing.PayloadObjectId ??= payloadObjectId;
            existing.Status = "Processing";
            existing.ProcessingAttempts += 1;
            existing.ProcessingLeaseId = leaseId;
            existing.ProcessingLeaseExpiresAt = leaseExpiresAt;
            existing.LastError = null;
            existing.FailedAt = null;
            existing.UpdatedAt = now;
        }

        private async Task MarkWebhookEventProcessedAsync(string stripeEventId, Guid leaseId)
        {
            var now = _timeProvider.GetUtcNow().UtcDateTime;
            if (!_context.Database.IsRelational())
            {
                await UpdateOwnedInMemoryClaimAsync(stripeEventId, leaseId, entry =>
                {
                    entry.Status = "Processed";
                    entry.ProcessedAt = now;
                    entry.UpdatedAt = now;
                    entry.ProcessingLeaseId = null;
                    entry.ProcessingLeaseExpiresAt = null;
                });
                return;
            }

            await _context.StripeWebhookEvents
                .Where(e => e.StripeEventId == stripeEventId && e.ProcessingLeaseId == leaseId)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(e => e.Status, "Processed")
                    .SetProperty(e => e.ProcessedAt, now)
                    .SetProperty(e => e.UpdatedAt, now)
                    .SetProperty(e => e.ProcessingLeaseId, (Guid?)null)
                    .SetProperty(e => e.ProcessingLeaseExpiresAt, (DateTime?)null));
        }

        private async Task MarkWebhookEventFailedAsync(string? stripeEventId, Guid? leaseId, Exception ex)
        {
            if (stripeEventId == null || leaseId == null) return;

            var now = _timeProvider.GetUtcNow().UtcDateTime;
            var error = ex.Message.Length <= 2000 ? ex.Message : ex.Message[..2000];
            try
            {
                if (!_context.Database.IsRelational())
                {
                    await UpdateOwnedInMemoryClaimAsync(stripeEventId, leaseId.Value, entry =>
                    {
                        entry.Status = "Failed";
                        entry.FailedAt = now;
                        entry.UpdatedAt = now;
                        entry.LastError = error;
                        entry.ProcessingLeaseId = null;
                        entry.ProcessingLeaseExpiresAt = null;
                    });
                    return;
                }

                await _context.StripeWebhookEvents
                    .Where(e => e.StripeEventId == stripeEventId && e.ProcessingLeaseId == leaseId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(e => e.Status, "Failed")
                        .SetProperty(e => e.FailedAt, now)
                        .SetProperty(e => e.UpdatedAt, now)
                        .SetProperty(e => e.LastError, error)
                        .SetProperty(e => e.ProcessingLeaseId, (Guid?)null)
                        .SetProperty(e => e.ProcessingLeaseExpiresAt, (DateTime?)null));
            }
            catch (Exception logEx)
            {
                _logger.LogError(logEx, "Failed to update Stripe webhook event failure status for {StripeEventId}", stripeEventId);
            }
        }

        private async Task UpdateOwnedInMemoryClaimAsync(string stripeEventId, Guid leaseId,
            Action<brownstone_hub_api.Models.StripeWebhookEvent> update)
        {
            var entry = await _context.StripeWebhookEvents.SingleOrDefaultAsync(e =>
                e.StripeEventId == stripeEventId && e.ProcessingLeaseId == leaseId);
            if (entry != null)
            {
                update(entry);
                await _context.SaveChangesAsync();
            }
        }

        private static string? GetStripePayloadObjectId(Event stripeEvent)
        {
            var payloadObject = stripeEvent.Data?.Object;
            return payloadObject?.GetType().GetProperty("Id")?.GetValue(payloadObject)?.ToString();
        }

        private static void ReleaseDispatchFenceReference(string key, DispatchFenceEntry entry)
        {
            lock (InMemoryDispatchFenceGate)
            {
                entry.ReferenceCount--;
                if (entry.ReferenceCount == 0 &&
                    InMemoryDispatchFences.TryGetValue(key, out var current) &&
                    ReferenceEquals(current, entry))
                {
                    InMemoryDispatchFences.Remove(key);
                    entry.Semaphore.Dispose();
                }
            }
        }

        private sealed class DispatchFenceEntry
        {
            public SemaphoreSlim Semaphore { get; } = new(1, 1);
            public int ReferenceCount { get; set; }
        }

        private sealed class SemaphoreDispatchFence(string key, DispatchFenceEntry entry) : IAsyncDisposable
        {
            public ValueTask DisposeAsync()
            {
                entry.Semaphore.Release();
                ReleaseDispatchFenceReference(key, entry);
                return ValueTask.CompletedTask;
            }
        }

        private sealed class SqlDispatchFence(
            SqlConnection connection,
            string resource,
            ILogger<StripeWebhookController> logger) : IAsyncDisposable
        {
            public async ValueTask DisposeAsync()
            {
                try
                {
                    await using var command = connection.CreateCommand();
                    command.CommandText = "EXEC sys.sp_releaseapplock @Resource=@resource, @LockOwner='Session';";
                    command.Parameters.AddWithValue("@resource", resource);
                    await command.ExecuteNonQueryAsync(CancellationToken.None);
                }
                catch (Exception ex)
                {
                    logger.LogCritical(ex,
                        "Failed to explicitly release Stripe webhook dispatch fence {Resource}; closing its dedicated connection.",
                        resource);
                }
                finally
                {
                    await connection.DisposeAsync();
                }
            }
        }

        private enum WebhookClaimStatus { Claimed, Processed, InProgress }
        private sealed record WebhookClaim(WebhookClaimStatus Status, Guid? LeaseId);

        [HttpGet("test")]
        public IActionResult TestWebhookEndpoint()
        {
            _logger.LogWarning("Webhook test endpoint called");
            return Ok(new
            {
                message = "Webhook endpoint is accessible!",
                timestamp = DateTime.UtcNow,
                endpoint = "/api/stripe/webhook",
                baseUrl = $"{Request.Scheme}://{Request.Host}",
                fullUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}/api/stripe/webhook",
                note = "The actual webhook endpoint is POST /api/stripe/webhook"
            });
        }

        [HttpGet]
        [HttpHead]
        public IActionResult WebhookHealthCheck()
        {
            _logger.LogInformation("Webhook health check called from {RemoteIp}", Request.HttpContext.Connection.RemoteIpAddress);
            return Ok(new
            {
                status = "healthy",
                endpoint = "/api/stripe/webhook",
                timestamp = DateTime.UtcNow
            });
        }
    }
}
