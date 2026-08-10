using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.SmsService;

namespace brownstone_hub_api.Services.MessageDeliveries;

public interface IMessageDeliveryProcessor
{
    Task<int> ProcessDueAsync(CancellationToken cancellationToken = default);
}

public sealed class MessageDeliveryProcessor(
    IMessageDeliveryService deliveries,
    ICommunicationDestinationProtector protector,
    ISmsService sms,
    IOutboundSmsSecurityService outboundSmsSecurity,
    IEmailService email,
    ILogger<MessageDeliveryProcessor> logger) : IMessageDeliveryProcessor
{
    private const int MaxAttempts = 5;

    public async Task<int> ProcessDueAsync(CancellationToken cancellationToken = default)
    {
        var leaseId = Guid.NewGuid();
        var leased = await deliveries.LeaseDueAsync(25, leaseId, TimeSpan.FromMinutes(2), cancellationToken);
        foreach (var delivery in leased)
            await ProcessOneAsync(delivery, leaseId, cancellationToken);
        return leased.Count;
    }

    private async Task ProcessOneAsync(MessageDelivery delivery, Guid leaseId, CancellationToken ct)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(delivery.ProtectedDestination))
            {
                await FailAsync(delivery, "missing_destination", false, null, ct);
                return;
            }

            var destination = protector.Unprotect(delivery.ProtectedDestination);
            var from = string.IsNullOrWhiteSpace(delivery.ProtectedFromAddress)
                ? null : protector.Unprotect(delivery.ProtectedFromAddress);

            if (delivery.Channel == MessageDeliveryChannel.Sms)
            {
                // Re-evaluate current plan/lifecycle, provider credentials, persisted resource scope,
                // and the organization's current active-primary number immediately before submission.
                // The snapshot From is audit evidence only and can never override current ownership.
                var authorization = await outboundSmsSecurity.AuthorizeDeliveryAsync(delivery.Id, ct);
                if (!authorization.IsAllowed || string.IsNullOrWhiteSpace(authorization.From))
                {
                    await FailAsync(delivery, authorization.ReasonCode ?? "sms_not_authorized", false, null, ct);
                    return;
                }
                from = authorization.From;
            }

            // Persist the at-most-once boundary before provider invocation. The immutable outbox key
            // is passed as a stable token for providers/adapters that can honor idempotency.
            await deliveries.RecordSubmissionStartedAsync(delivery.Id, leaseId, ct);

            if (delivery.Channel == MessageDeliveryChannel.Sms)
            {
                var result = await sms.SubmitSmsAsync(destination, delivery.BodySnapshot, ct, from, delivery.IdempotencyKey);
                await RecordAsync(delivery, leaseId, result.Accepted, result.Provider, result.ProviderMessageId,
                    result.ErrorCode, result.ErrorDetail, result.Retryable, ct);
            }
            else if (delivery.Channel == MessageDeliveryChannel.Email)
            {
                var result = await email.SubmitEmailAsync(destination, delivery.SubjectSnapshot ?? "Property Peace message",
                    delivery.HtmlBodySnapshot ?? delivery.BodySnapshot, delivery.BodySnapshot, from, ct, delivery.IdempotencyKey);
                await RecordAsync(delivery, leaseId, result.Accepted, result.Provider, result.ProviderMessageId,
                    result.ErrorCode, result.ErrorDetail, result.Retryable, ct);
            }
            else
            {
                await FailAsync(delivery, "unsupported_channel", false, null, ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Message delivery attempt {DeliveryId} failed", delivery.Id);
            // The provider may have accepted before the exception reached us. Retrying this ambiguous
            // outcome would duplicate a successful send, so park it for reconciliation.
            await FailAsync(delivery, "submission_outcome_unknown", false, ex.Message, ct);
        }
    }

    private async Task RecordAsync(MessageDelivery delivery, Guid leaseId, bool accepted, string provider,
        string? providerMessageId, string? errorCode, string? detail, bool retryable, CancellationToken ct)
    {
        if (accepted && !string.IsNullOrWhiteSpace(provider) && !string.IsNullOrWhiteSpace(providerMessageId))
        {
            await deliveries.RecordSubmittedAsync(delivery.Id, leaseId, provider, providerMessageId, ct);
            return;
        }

        var code = accepted ? "provider_identity_missing" : errorCode ?? "submission_rejected";
        await FailAsync(delivery, code, !accepted && retryable && delivery.AttemptCount < MaxAttempts, detail, ct);
    }

    private Task<MessageDelivery> FailAsync(MessageDelivery delivery, string code, bool retryable, string? detail, CancellationToken ct) =>
        deliveries.RecordFailedAsync(delivery.Id, code, detail, retryable,
            retryable ? TimeSpan.FromMinutes(Math.Min(60, Math.Pow(2, delivery.AttemptCount))) : null, ct);
}

public sealed class MessageDeliveryBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<MessageDeliveryBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var count = await scope.ServiceProvider.GetRequiredService<IMessageDeliveryProcessor>()
                    .ProcessDueAsync(stoppingToken);
                await Task.Delay(count == 0 ? TimeSpan.FromSeconds(5) : TimeSpan.FromMilliseconds(100), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception ex)
            {
                logger.LogError(ex, "Message delivery worker cycle failed");
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }
}
