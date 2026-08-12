using System.Net;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Leads;

public interface ILeadNotificationDispatcher
{
    Task<int> DispatchPendingAsync(CancellationToken ct);
}

/// <summary>Leased transactional-outbox consumer for non-secret showing lifecycle email.</summary>
public sealed class LeadNotificationDispatcher(
    DataContext db, IEmailService email, TimeProvider clock, ILogger<LeadNotificationDispatcher> logger)
    : ILeadNotificationDispatcher
{
    private const int MaxAttempts = 5;
    private static readonly SemaphoreSlim InProcessClaim = new(1, 1);

    public async Task<int> DispatchPendingAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var lease = Guid.NewGuid();
        var ids = await ClaimAsync(lease, now, ct);
        if (ids.Count == 0) return 0;
        var sent = 0;
        foreach (var id in ids)
        {
            var intent = await db.LeadNotificationIntents.SingleAsync(x => x.Id == id && x.LeaseId == lease, ct);
            intent.AttemptCount++;
            intent.LastAttemptAtUtc = now;
            // The claim and attempt are durable before the external call. A provider-side idempotency key would be
            // needed to close the unavoidable crash window after provider acceptance and before Sent is persisted.
            await db.SaveChangesAsync(ct);
            try
            {
                var message = await BuildAsync(intent, ct);
                if (message is null)
                {
                    intent.Status = NotificationIntentStatus.Cancelled; // stale reminder/confirmation, fail safe
                }
                else if (await email.SendEmailAsync(message.To, message.Subject, message.Html, message.Text, ct))
                {
                    intent.Status = NotificationIntentStatus.Sent;
                    intent.SentAtUtc = clock.GetUtcNow().UtcDateTime;
                    intent.LastError = null;
                    intent.NextAttemptAtUtc = null;
                    sent++;
                }
                else
                {
                    Fail(intent, "Email provider did not accept the message.", now);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Fail(intent, ex.GetType().Name, now);
                logger.LogWarning("Lead notification intent {IntentId} failed ({ErrorType}).", intent.Id, ex.GetType().Name);
            }
            intent.LeaseId = null;
            intent.LeaseUntilUtc = null;
            await db.SaveChangesAsync(ct);
        }
        return sent;
    }

    private async Task<List<long>> ClaimAsync(Guid lease, DateTime now, CancellationToken ct)
    {
        await InProcessClaim.WaitAsync(ct);
        try
        {
            var ids = await db.LeadNotificationIntents.AsNoTracking()
                .Where(x => x.Status == NotificationIntentStatus.Pending && x.NotBeforeUtc <= now &&
                    (x.NextAttemptAtUtc == null || x.NextAttemptAtUtc <= now) &&
                    (x.LeaseUntilUtc == null || x.LeaseUntilUtc <= now))
                .OrderBy(x => x.CreatedAtUtc).Select(x => x.Id).Take(25).ToListAsync(ct);
            if (ids.Count == 0) return ids;
            if (db.Database.IsRelational())
            {
                await db.LeadNotificationIntents.Where(x => ids.Contains(x.Id) &&
                        x.Status == NotificationIntentStatus.Pending &&
                        (x.LeaseUntilUtc == null || x.LeaseUntilUtc <= now))
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.LeaseId, lease)
                        .SetProperty(x => x.LeaseUntilUtc, now.AddMinutes(5)), ct);
                return await db.LeadNotificationIntents.AsNoTracking().Where(x => x.LeaseId == lease)
                    .Select(x => x.Id).ToListAsync(ct);
            }
            var rows = await db.LeadNotificationIntents.Where(x => ids.Contains(x.Id)).ToListAsync(ct);
            foreach (var row in rows) { row.LeaseId = lease; row.LeaseUntilUtc = now.AddMinutes(5); }
            await db.SaveChangesAsync(ct);
            return rows.Select(x => x.Id).ToList();
        }
        finally { InProcessClaim.Release(); }
    }

    private async Task<Message?> BuildAsync(LeadNotificationIntent intent, CancellationToken ct)
    {
        var data = await (from showing in db.Showings.AsNoTracking()
            join lead in db.Leads.AsNoTracking() on new { showing.LeadId, showing.OrganizationId }
                equals new { LeadId = lead.Id, lead.OrganizationId }
            join listing in db.Listings.AsNoTracking() on new { Id = showing.ListingId, Org = (long?)showing.OrganizationId }
                equals new { listing.Id, Org = listing.OrganizationId }
            where showing.Id == intent.ShowingId && lead.Id == intent.LeadId &&
                  showing.OrganizationId == intent.OrganizationId
            select new { Showing = showing, Lead = lead, Listing = listing }).SingleOrDefaultAsync(ct);
        if (data is null) throw new InvalidOperationException("Notification scope is no longer valid.");
        var cancellation = intent.Kind == LeadNotificationKind.ShowingCancellation;
        if (cancellation ? data.Showing.Status != ShowingStatus.Cancelled : data.Showing.Status != ShowingStatus.Confirmed)
            return null;

        var zone = TimeZoneInfo.FindSystemTimeZoneById(data.Showing.BoundaryTimeZoneId);
        var start = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(data.Showing.StartsAtUtc, DateTimeKind.Utc), zone);
        var end = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(data.Showing.EndsAtUtc, DateTimeKind.Utc), zone);
        var slot = $"{start:dddd, MMMM d, yyyy h:mm tt}–{end:h:mm tt} ({data.Showing.BoundaryTimeZoneId})";
        var listingLabel = string.IsNullOrWhiteSpace(data.Listing.ListingNumber)
            ? $"listing {data.Listing.Id}" : $"listing {data.Listing.ListingNumber}";
        var title = intent.Kind switch
        {
            LeadNotificationKind.ShowingConfirmation => "Showing confirmed",
            LeadNotificationKind.ShowingReminder => "Showing reminder",
            LeadNotificationKind.ShowingCancellation => "Showing cancelled",
            LeadNotificationKind.ShowingRescheduled => "Showing rescheduled",
            _ => throw new InvalidOperationException("Unsupported showing notification kind.")
        };
        var action = intent.Kind switch
        {
            LeadNotificationKind.ShowingConfirmation => "is confirmed for",
            LeadNotificationKind.ShowingReminder => "is coming up at",
            LeadNotificationKind.ShowingCancellation => "was cancelled. Its scheduled time was",
            _ => "was rescheduled to"
        };
        var management = $"Showing reference: {data.Showing.Id}. To manage it, open the same public {listingLabel} page, select “Manage a showing,” then enter this showing reference and the management code delivered separately. Never put the management code in a URL.";
        var text = $"{title}\n\nYour showing for {listingLabel} {action} {slot}.\n\n{management}";
        var html = $"<h2>{WebUtility.HtmlEncode(title)}</h2><p>Your showing for {WebUtility.HtmlEncode(listingLabel)} {WebUtility.HtmlEncode(action)} <strong>{WebUtility.HtmlEncode(slot)}</strong>.</p><p>{WebUtility.HtmlEncode(management)}</p>";
        return new(data.Lead.Email, title, html, text);
    }

    private static void Fail(LeadNotificationIntent intent, string error, DateTime now)
    {
        intent.LastError = error.Length <= 500 ? error : error[..500];
        if (intent.AttemptCount >= MaxAttempts)
        {
            intent.Status = NotificationIntentStatus.Failed;
            intent.NextAttemptAtUtc = null;
        }
        else intent.NextAttemptAtUtc = now.AddMinutes(Math.Pow(2, intent.AttemptCount));
    }

    private sealed record Message(string To, string Subject, string Html, string Text);
}

public sealed class LeadNotificationDeliveryBackgroundService(
    IServiceScopeFactory scopeFactory, ILogger<LeadNotificationDeliveryBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        do
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                await scope.ServiceProvider.GetRequiredService<ILeadNotificationDispatcher>()
                    .DispatchPendingAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception ex) { logger.LogError(ex, "Lead notification outbox dispatch cycle failed."); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
