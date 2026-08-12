using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.Timeline;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Services.MessageDeliveries;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Timelines;

/// <summary>
/// Bridges legacy production notification workflows into the immutable communication timeline.
/// A missing context/conversation is a no-op: workflows must never invent a broad or cross-org context.
/// </summary>
public interface IWorkflowTimelineIntegration
{
    Task RecordNotificationAttemptAsync(CreateNotificationDto notification, long? notificationId,
        string? emailDestination, string? smsDestination, bool emailWillSend, bool smsWillSend,
        CancellationToken cancellationToken = default);
    Task RecordApplicationTransitionAsync(long organizationId, long rentalApplicationId, long? actorUserId,
        string status, string summary, string eventId, CancellationToken cancellationToken = default);
    Task RecordScreeningTransitionAsync(long organizationId, long rentalApplicationId, long screeningOrderId,
        long? actorUserId, string status, string summary, string eventId, CancellationToken cancellationToken = default);
}

public sealed class WorkflowTimelineIntegration(
    DataContext db,
    IConversationTimelineRepository timeline,
    IMessageDeliveryService deliveries,
    TimeProvider clock,
    ConversationContextService contextLinks) : IWorkflowTimelineIntegration
{
    public async Task RecordNotificationAttemptAsync(CreateNotificationDto notification, long? notificationId,
        string? emailDestination, string? smsDestination, bool emailWillSend, bool smsWillSend,
        CancellationToken cancellationToken = default)
    {
        if (!notification.RelatedId.HasValue || (!notification.SendInApp && !emailWillSend && !smsWillSend)) return;
        var resolved = await ResolveAsync(notification.Type, notification.RelatedId.Value, notification.OrganizationId, cancellationToken);
        if (resolved is null) return;

        var operationId = notificationId?.ToString() ?? Hash($"{resolved.OrganizationId}|{notification.UserId}|{notification.Type}|{notification.RelatedId}|{notification.Title}|{notification.Message}")[..32];
        var metadata = new Dictionary<string, string>
        {
            ["status"] = "attempted",
            ["channel"] = string.Join(',', Channels(notification.SendInApp, emailWillSend, smsWillSend)),
            ["reminderType"] = notification.Type.ToString()
        };
        var payload = Hash($"{resolved.ConversationId}|{operationId}|{notification.UserId}|{notification.Title}|{notification.Message}|{metadata["channel"]}");
        var entry = await timeline.AppendAsync(new AppendTimelineEntryRequest
        {
            OrganizationId = resolved.OrganizationId,
            ConversationId = resolved.ConversationId,
            Kind = Kind(notification.Type),
            OccurredAtUtc = clock.GetUtcNow().UtcDateTime,
            ActorUserId = notification.PerformedByUserId,
            SourceType = "notification",
            SourceId = operationId,
            Summary = notification.Title,
            Metadata = metadata,
            ContextKind = resolved.Kind,
            ContextId = resolved.ContextId,
            ContextLabel = $"{resolved.Kind} {resolved.ContextId}",
            Visibility = TimelineVisibility.Participants,
            Producer = "notification-service",
            EventId = $"{notification.UserId}:{operationId}",
            PayloadHash = payload
        }, cancellationToken);

        // NotificationService owns these legacy provider calls. Keep this bridge audit-only: creating
        // outbox rows here would send a second copy and previously stored empty body snapshots.
        // "attempted" is intentionally the strongest evidence available before the legacy send.
        _ = deliveries; // Constructor compatibility while this integration remains audit-only.
    }

    public Task RecordApplicationTransitionAsync(long organizationId, long rentalApplicationId, long? actorUserId,
        string status, string summary, string eventId, CancellationToken cancellationToken = default) =>
        RecordContextualWorkflowAsync(organizationId, rentalApplicationId, actorUserId, TimelineEntryKind.StatusChanged,
            "application", rentalApplicationId.ToString(), status, summary, eventId, cancellationToken);

    public Task RecordScreeningTransitionAsync(long organizationId, long rentalApplicationId, long screeningOrderId,
        long? actorUserId, string status, string summary, string eventId, CancellationToken cancellationToken = default) =>
        RecordContextualWorkflowAsync(organizationId, rentalApplicationId, actorUserId, TimelineEntryKind.Screening,
            "screening", screeningOrderId.ToString(), status, summary, eventId, cancellationToken);

    private async Task RecordContextualWorkflowAsync(long organizationId, long applicationId, long? actorUserId,
        TimelineEntryKind kind, string sourceType, string sourceId, string status, string summary, string eventId, CancellationToken ct)
    {
        if (organizationId <= 0 || applicationId <= 0 || string.IsNullOrWhiteSpace(eventId)) return;
        var application = await db.RentalApplications.AsNoTracking().Where(x => x.Id == applicationId)
            .Select(x => new { x.OrganizationId, x.PropertyId, x.UnitId }).SingleOrDefaultAsync(ct);
        if (application?.OrganizationId != organizationId) return;

        var direct = await db.ConversationContextLinks.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && x.RentalApplicationId == applicationId)
            .Select(x => x.ConversationId).Distinct().Take(2).ToListAsync(ct);
        if (direct.Count > 1) return;
        long conversationId;
        if (direct.Count == 1) conversationId = direct[0];
        else
        {
            var candidates = await db.ConversationContextLinks.AsNoTracking().Where(x => x.OrganizationId == organizationId &&
                    (application.UnitId.HasValue ? x.UnitId == application.UnitId : x.PropertyId == application.PropertyId))
                .Select(x => x.ConversationId).Distinct().Take(2).ToListAsync(ct);
            if (candidates.Count != 1) return;
            conversationId = candidates[0];
            try
            {
                await contextLinks.AddLinksAsync(organizationId, conversationId,
                    [new ConversationContextTarget { RentalApplicationId = applicationId }], ct);
            }
            catch (Exception ex) when (ex is KeyNotFoundException or InvalidOperationException or ArgumentException) { return; }
        }

        await timeline.AppendAsync(new AppendTimelineEntryRequest
        {
            OrganizationId = organizationId, ConversationId = conversationId, Kind = kind,
            OccurredAtUtc = clock.GetUtcNow().UtcDateTime, ActorUserId = actorUserId,
            SourceType = sourceType, SourceId = sourceId, Summary = summary,
            Metadata = new Dictionary<string, string> { ["status"] = status },
            ContextKind = "rentalApplication", ContextId = applicationId, ContextLabel = $"Application {applicationId}",
            Visibility = TimelineVisibility.Participants, Producer = "workflow-service", EventId = eventId,
            PayloadHash = Hash($"{organizationId}|{conversationId}|{applicationId}|{sourceType}|{sourceId}|{status}|{summary}")
        }, ct);
    }

    private async Task<ResolvedContext?> ResolveAsync(ENotificationType type, long id, long? requestedOrganizationId, CancellationToken ct)
    {
        string kind;
        long contextId = id;
        long? organizationId;
        long? fallbackLeaseId = null;
        switch (type)
        {
            case ENotificationType.Maintenance:
                kind = "maintenance";
                organizationId = await db.MaintenanceRequests.Where(x => x.Id == id).Select(x => x.OrganizationId).SingleOrDefaultAsync(ct);
                break;
            case ENotificationType.Payment:
                kind = "payment";
                var payment = await db.Payments.Where(x => x.Id == id).Select(x => new { x.OrganizationId, x.LeaseId }).SingleOrDefaultAsync(ct);
                organizationId = payment?.OrganizationId;
                fallbackLeaseId = payment?.LeaseId;
                break;
            case ENotificationType.Lease:
            case ENotificationType.Rent:
                kind = "lease";
                organizationId = await db.Leases.Where(x => x.Id == id).Select(x => x.OrganizationId).SingleOrDefaultAsync(ct);
                break;
            case ENotificationType.RentPaymentSetupReminder:
                kind = "property";
                organizationId = await db.Properties.Where(x => x.Id == id).Select(x => (long?)x.OrganizationId).SingleOrDefaultAsync(ct);
                break;
            default:
                return null;
        }
        if (!organizationId.HasValue || requestedOrganizationId.HasValue && requestedOrganizationId != organizationId) return null;

        var link = await db.ConversationContextLinks.AsNoTracking().Where(x => x.OrganizationId == organizationId &&
            (kind == "maintenance" && x.MaintenanceRequestId == contextId || kind == "payment" && x.PaymentId == contextId ||
             kind == "lease" && x.LeaseId == contextId || kind == "property" && x.PropertyId == contextId))
            .Select(x => (long?)x.ConversationId).FirstOrDefaultAsync(ct);
        if (!link.HasValue && fallbackLeaseId.HasValue)
            link = await db.ConversationContextLinks.AsNoTracking().Where(x => x.OrganizationId == organizationId && x.LeaseId == fallbackLeaseId)
                .Select(x => (long?)x.ConversationId).FirstOrDefaultAsync(ct);
        if (!link.HasValue)
            link = await db.Conversations.AsNoTracking().Where(x => x.OrganizationId == organizationId &&
                (kind == "maintenance" && x.MaintenanceRequestId == contextId || kind == "lease" && x.LeaseId == contextId ||
                 kind == "property" && x.PropertyId == contextId || fallbackLeaseId.HasValue && x.LeaseId == fallbackLeaseId))
                .Select(x => (long?)x.Id).FirstOrDefaultAsync(ct);
        return link.HasValue ? new ResolvedContext(organizationId.Value, link.Value, kind, contextId) : null;
    }

    private static TimelineEntryKind Kind(ENotificationType type) => type switch
    {
        ENotificationType.Maintenance => TimelineEntryKind.Maintenance,
        ENotificationType.Payment => TimelineEntryKind.Payment,
        ENotificationType.Lease => TimelineEntryKind.Lease,
        _ => TimelineEntryKind.Reminder
    };

    private static IEnumerable<string> Channels(bool inApp, bool email, bool sms)
    {
        if (inApp) yield return "inApp";
        if (email) yield return "email";
        if (sms) yield return "sms";
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    private sealed record ResolvedContext(long OrganizationId, long ConversationId, string Kind, long ContextId);
}
