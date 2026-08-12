using System.Net;
using System.Text.Json;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.EmailService;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Leads;

public interface ILeadTokenDispatcher
{
    Task<int> DispatchPendingAsync(CancellationToken ct);
}

/// <summary>Dispatches the encrypted token outbox through the application's canonical email provider.</summary>
public sealed class LeadTokenDispatcher(
    DataContext db,
    IDataProtectionProvider protectionProvider,
    IEmailService email,
    TimeProvider clock,
    ILogger<LeadTokenDispatcher> logger) : ILeadTokenDispatcher
{
    private static readonly SemaphoreSlim InProcessClaim = new(1, 1);
    private readonly IDataProtector protector = protectionProvider.CreateProtector("lead-token-delivery-v1");

    public async Task<int> DispatchPendingAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var lease = Guid.NewGuid();
        var ids = await ClaimAsync(lease, now, ct);
        if (ids.Count == 0) return 0;

        var sent = 0;
        foreach (var id in ids)
        {
            var delivery = await db.LeadTokenDeliveries.SingleAsync(x => x.Id == id && x.LeaseId == lease, ct);
            delivery.AttemptCount++;
            delivery.LastAttemptAtUtc = now;
            // Persist the claim and attempt before the external call. Provider-side idempotency would
            // still be required to close the crash window after acceptance and before Sent is saved.
            await db.SaveChangesAsync(ct);
            try
            {
                var payload = JsonSerializer.Deserialize<TokenPayload>(protector.Unprotect(delivery.ProtectedPayload))
                    ?? throw new InvalidOperationException("Protected token payload is invalid.");
                if (payload.Purpose != delivery.Purpose || string.IsNullOrWhiteSpace(payload.Token))
                    throw new InvalidOperationException("Protected token payload does not match its envelope.");

                var token = WebUtility.HtmlEncode(payload.Token);
                var purpose = delivery.Purpose == LeadTokenPurpose.ContactVerification
                    ? "Verify your contact information"
                    : "Your showing management access";
                var explanation = delivery.Purpose == LeadTokenPurpose.ContactVerification
                    ? "Enter this one-time verification code in the listing contact-verification form:"
                    : "This is your private showing management code. Keep it separate from your showing reference. To manage a showing, open the same public listing page, select “Manage a showing,” then enter the showing reference from your confirmation and this code:";
                var ok = await email.SendEmailAsync(delivery.Destination, purpose,
                    $"<p>{explanation}</p><p><code>{token}</code></p><p>Do not share this token.</p>",
                    $"{explanation}\n\n{payload.Token}\n\nDo not share this token.", ct);
                if (!ok)
                {
                    delivery.LastError = "Email provider did not accept the message.";
                    delivery.NextAttemptAtUtc = now.AddMinutes(Math.Min(60, Math.Pow(2, Math.Min(6, delivery.AttemptCount))));
                }
                else
                {
                    delivery.Status = NotificationIntentStatus.Sent;
                    delivery.SentAtUtc = clock.GetUtcNow().UtcDateTime;
                    delivery.NextAttemptAtUtc = null;
                    delivery.LastError = null;
                    sent++;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Never log the protected or plaintext credential, nor recipient PII.
                delivery.LastError = ex.GetType().Name;
                delivery.NextAttemptAtUtc = now.AddMinutes(Math.Min(60, Math.Pow(2, Math.Min(6, delivery.AttemptCount))));
                logger.LogWarning("Lead token delivery {DeliveryId} could not be dispatched ({ErrorType}).",
                    delivery.Id, ex.GetType().Name);
            }
            delivery.LeaseId = null;
            delivery.LeaseUntilUtc = null;
            await db.SaveChangesAsync(ct);
        }
        return sent;
    }

    private async Task<List<long>> ClaimAsync(Guid lease, DateTime now, CancellationToken ct)
    {
        await InProcessClaim.WaitAsync(ct);
        try
        {
            var ids = await db.LeadTokenDeliveries.AsNoTracking()
                .Where(x => x.Status == NotificationIntentStatus.Pending &&
                    (x.NextAttemptAtUtc == null || x.NextAttemptAtUtc <= now) &&
                    (x.LeaseUntilUtc == null || x.LeaseUntilUtc <= now))
                .OrderBy(x => x.CreatedAtUtc).Select(x => x.Id).Take(25).ToListAsync(ct);
            if (ids.Count == 0) return ids;
            if (db.Database.IsRelational())
            {
                await db.LeadTokenDeliveries.Where(x => ids.Contains(x.Id) &&
                        x.Status == NotificationIntentStatus.Pending &&
                        (x.LeaseUntilUtc == null || x.LeaseUntilUtc <= now))
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.LeaseId, lease)
                        .SetProperty(x => x.LeaseUntilUtc, now.AddMinutes(5)), ct);
                return await db.LeadTokenDeliveries.AsNoTracking().Where(x => x.LeaseId == lease)
                    .Select(x => x.Id).ToListAsync(ct);
            }
            var rows = await db.LeadTokenDeliveries.Where(x => ids.Contains(x.Id) &&
                (x.LeaseUntilUtc == null || x.LeaseUntilUtc <= now)).ToListAsync(ct);
            foreach (var row in rows) { row.LeaseId = lease; row.LeaseUntilUtc = now.AddMinutes(5); }
            await db.SaveChangesAsync(ct);
            return rows.Select(x => x.Id).ToList();
        }
        finally { InProcessClaim.Release(); }
    }

    private sealed record TokenPayload(LeadTokenPurpose Purpose, string Token);
}

public sealed class LeadTokenDeliveryBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<LeadTokenDeliveryBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<ILeadTokenDispatcher>().DispatchPendingAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception ex)
            {
                logger.LogError(ex, "Lead token outbox dispatch cycle failed.");
            }
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }
}
