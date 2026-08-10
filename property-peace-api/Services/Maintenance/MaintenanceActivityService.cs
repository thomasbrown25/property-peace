using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Timeline;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Timelines;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Maintenance;

public interface IMaintenanceActivityService
{
    Task<MaintenanceActivityEvent> RecordAsync(MaintenanceRequest request, long actorUserId, string eventType,
        string subjectType, long subjectId, string summary, MaintenanceActivityVisibility visibility,
        string? status = null, string? reason = null, CancellationToken cancellationToken = default);
    Task ProjectAsync(MaintenanceActivityEvent activity, CancellationToken cancellationToken = default);
    Task<int> ProjectPendingAsync(int take = 50, CancellationToken cancellationToken = default);
}

public sealed class MaintenanceActivityService(
    DataContext db,
    IConversationTimelineRepository timeline,
    TimeProvider clock) : IMaintenanceActivityService
{
    private const int MaxAttempts = 10;

    public async Task<MaintenanceActivityEvent> RecordAsync(MaintenanceRequest request, long actorUserId, string eventType,
        string subjectType, long subjectId, string summary, MaintenanceActivityVisibility visibility,
        string? status = null, string? reason = null, CancellationToken cancellationToken = default)
    {
        var metadata = new Dictionary<string, string>(StringComparer.Ordinal);
        if (!string.IsNullOrWhiteSpace(status)) metadata["status"] = status.Trim();
        if (!string.IsNullOrWhiteSpace(reason)) metadata["reason"] = reason.Trim();
        var activity = new MaintenanceActivityEvent
        {
            MaintenanceRequestId = request.Id,
            ActorUserId = actorUserId,
            EventType = eventType,
            SubjectType = subjectType,
            SubjectId = subjectId,
            Summary = summary,
            Visibility = visibility,
            MetadataJson = JsonSerializer.Serialize(metadata),
            OccurredAtUtc = clock.GetUtcNow()
        };
        db.MaintenanceActivityEvents.Add(activity);
        var outbox = new MaintenanceTimelineOutbox
        {
            MaintenanceActivityEvent = activity,
            AvailableAtUtc = clock.GetUtcNow()
        };
        db.MaintenanceTimelineOutboxes.Add(outbox);
        await db.SaveChangesAsync(cancellationToken);
        await ClaimAndProcessAsync(outbox.Id, cancellationToken);
        return activity;
    }

    public async Task<int> ProjectPendingAsync(int take = 50, CancellationToken cancellationToken = default)
    {
        var now = clock.GetUtcNow();
        var pendingIds = await db.MaintenanceTimelineOutboxes.AsNoTracking()
            .Where(x => x.ProcessedAtUtc == null && x.DeadLetteredAtUtc == null &&
                        x.AvailableAtUtc <= now &&
                        (x.NextAttemptAtUtc == null || x.NextAttemptAtUtc <= now) &&
                        (x.ProcessingLeaseUntilUtc == null || x.ProcessingLeaseUntilUtc <= now))
            .OrderBy(x => x.Id).Select(x => x.Id).Take(Math.Clamp(take, 1, 200)).ToListAsync(cancellationToken);
        var completed = 0;
        foreach (var id in pendingIds)
            if (await ClaimAndProcessAsync(id, cancellationToken)) completed++;
        return completed;
    }

    private async Task<bool> ClaimAndProcessAsync(long outboxId, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var leaseId = Guid.NewGuid();
        if (db.Database.IsRelational())
        {
            var claimed = await db.MaintenanceTimelineOutboxes
                .Where(x => x.Id == outboxId && x.ProcessedAtUtc == null && x.DeadLetteredAtUtc == null &&
                    x.AvailableAtUtc <= now && (x.NextAttemptAtUtc == null || x.NextAttemptAtUtc <= now) &&
                    (x.ProcessingLeaseUntilUtc == null || x.ProcessingLeaseUntilUtc <= now))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.ProcessingLeaseId, leaseId)
                    .SetProperty(x => x.ProcessingLeaseUntilUtc, now.AddMinutes(5)), cancellationToken);
            if (claimed != 1) return false;
            db.ChangeTracker.Clear();
        }
        else
        {
            var claim = await db.MaintenanceTimelineOutboxes.SingleOrDefaultAsync(x => x.Id == outboxId, cancellationToken);
            if (claim is null || claim.ProcessedAtUtc != null || claim.DeadLetteredAtUtc != null || claim.AvailableAtUtc > now ||
                claim.NextAttemptAtUtc > now || claim.ProcessingLeaseUntilUtc > now) return false;
            claim.ProcessingLeaseId = leaseId;
            claim.ProcessingLeaseUntilUtc = now.AddMinutes(5);
            await db.SaveChangesAsync(cancellationToken);
        }

        var outbox = await db.MaintenanceTimelineOutboxes.Include(x => x.MaintenanceActivityEvent)
            .SingleOrDefaultAsync(x => x.Id == outboxId && x.ProcessingLeaseId == leaseId, cancellationToken);
        return outbox is not null && await ProcessAsync(outbox, cancellationToken);
    }

    private async Task<bool> ProcessAsync(MaintenanceTimelineOutbox outbox, CancellationToken cancellationToken)
    {
        try
        {
            await ProjectAsync(outbox.MaintenanceActivityEvent, cancellationToken);
            outbox.AttemptCount++;
            outbox.ProcessedAtUtc = clock.GetUtcNow();
            outbox.DeadLetteredAtUtc = null;
            outbox.NextAttemptAtUtc = null;
            outbox.LastErrorCode = null;
            outbox.ProcessingLeaseId = null;
            outbox.ProcessingLeaseUntilUtc = null;
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            outbox.AttemptCount++;
            outbox.LastErrorCode = exception is MaintenanceProjectionUnresolvedException unresolved
                ? unresolved.ErrorCode
                : exception.GetType().Name;
            outbox.ProcessingLeaseId = null;
            outbox.ProcessingLeaseUntilUtc = null;
            if (outbox.AttemptCount >= MaxAttempts)
            {
                outbox.DeadLetteredAtUtc = clock.GetUtcNow();
                outbox.NextAttemptAtUtc = null;
            }
            else
            {
                var delayMinutes = Math.Min(60, 1 << Math.Min(outbox.AttemptCount - 1, 6));
                outbox.NextAttemptAtUtc = clock.GetUtcNow().AddMinutes(delayMinutes);
            }
            await db.SaveChangesAsync(cancellationToken);
            return false;
        }
    }

    public async Task ProjectAsync(MaintenanceActivityEvent activity, CancellationToken cancellationToken = default)
    {
        var request = await db.MaintenanceRequests.Include(x => x.Property).SingleAsync(x => x.Id == activity.MaintenanceRequestId, cancellationToken);
        if (!request.OrganizationId.HasValue)
            await TryBackfillOrganizationAsync(request, cancellationToken);
        if (!request.OrganizationId.HasValue)
            throw new MaintenanceProjectionUnresolvedException("maintenance.organization_unresolved");
        var conversationId = await ResolveOrCreateConversationAsync(request, cancellationToken);
        if (!conversationId.HasValue)
            throw new MaintenanceProjectionUnresolvedException("maintenance.conversation_unresolved");
        await ReconcileVendorParticipantAsync(request, conversationId.Value, cancellationToken);
        var metadata = JsonSerializer.Deserialize<Dictionary<string, string>>(activity.MetadataJson) ?? [];
        var payload = Hash($"{activity.Id}|{activity.MaintenanceRequestId}|{activity.ActorUserId}|{activity.EventType}|{activity.SubjectType}|{activity.SubjectId}|{activity.Summary}|{activity.Visibility}|{activity.MetadataJson}");
        await timeline.AppendAsync(new AppendTimelineEntryRequest
        {
            OrganizationId = request.OrganizationId.Value,
            ConversationId = conversationId.Value,
            Kind = TimelineEntryKind.Maintenance,
            OccurredAtUtc = activity.OccurredAtUtc.UtcDateTime,
            ActorUserId = activity.ActorUserId,
            SourceType = "maintenanceActivity",
            SourceId = activity.Id.ToString(),
            Summary = activity.Summary,
            Metadata = metadata,
            ContextKind = "maintenance",
            ContextId = request.Id,
            ContextLabel = $"Maintenance {request.Id}",
            Visibility = activity.Visibility == MaintenanceActivityVisibility.StaffOnly ? TimelineVisibility.StaffOnly : TimelineVisibility.Participants,
            Producer = "maintenance-workflow",
            EventId = $"activity:{activity.Id}",
            PayloadHash = payload
        }, cancellationToken);
    }

    private async Task TryBackfillOrganizationAsync(MaintenanceRequest request, CancellationToken ct)
    {
        // Legacy requests can predate OrganizationId. Only repair them when every durable,
        // request-linked source that has an organization agrees; conflicting evidence must retry
        // and ultimately dead-letter rather than project into the wrong tenant boundary.
        var candidates = new HashSet<long>();
        if (request.Property.OrganizationId is { } propertyOrganizationId)
            candidates.Add(propertyOrganizationId);

        if (request.SubmittedUnderLeaseId is { } leaseId)
        {
            var leaseOrganizationId = await db.Leases.Where(x => x.Id == leaseId)
                .Select(x => x.OrganizationId).SingleOrDefaultAsync(ct);
            if (leaseOrganizationId is { } value) candidates.Add(value);
        }
        if (request.SubmittedByTenantId is { } tenantId)
        {
            var tenantOrganizationId = await db.Tenants.Where(x => x.Id == tenantId)
                .Select(x => x.OrganizationId).SingleOrDefaultAsync(ct);
            if (tenantOrganizationId is { } value) candidates.Add(value);
        }

        var conversationOrganizations = await db.Conversations
            .Where(x => x.Id == request.ConversationId || x.MaintenanceRequestId == request.Id)
            .Where(x => x.OrganizationId != null)
            .Select(x => x.OrganizationId!.Value).Distinct().ToListAsync(ct);
        candidates.UnionWith(conversationOrganizations);

        var linkedOrganizations = await db.ConversationContextLinks
            .Where(x => x.MaintenanceRequestId == request.Id)
            .Select(x => x.OrganizationId).Distinct().ToListAsync(ct);
        candidates.UnionWith(linkedOrganizations);

        if (candidates.Count != 1) return;
        request.OrganizationId = candidates.Single();
        await db.SaveChangesAsync(ct);
    }

    private async Task<long?> ResolveOrCreateConversationAsync(MaintenanceRequest request, CancellationToken ct)
    {
        var linked = await db.ConversationContextLinks.Where(x => x.OrganizationId == request.OrganizationId && x.MaintenanceRequestId == request.Id)
            .Select(x => (long?)x.ConversationId).FirstOrDefaultAsync(ct);
        if (linked.HasValue) return linked;
        var direct = request.ConversationId ?? await db.Conversations.Where(x => x.OrganizationId == request.OrganizationId && x.MaintenanceRequestId == request.Id)
            .Select(x => (long?)x.Id).FirstOrDefaultAsync(ct);
        if (!direct.HasValue)
        {
            var tenantUserId = request.SubmittedByUserId;
            var conversation = new Conversation
            {
                OrganizationId = request.OrganizationId,
                LandlordId = request.Property.LandlordId,
                PropertyId = request.PropertyId,
                LeaseId = request.SubmittedUnderLeaseId,
                TenantId = request.SubmittedByTenantId,
                MaintenanceRequestId = request.Id,
                Title = $"Maintenance: {request.Title}",
                IsGroupChat = true,
                CreatedAt = clock.GetUtcNow().UtcDateTime,
                CreatedBy = tenantUserId ?? request.Property.LandlordId
            };
            conversation.Participants.Add(new ConversationParticipant { UserId = request.Property.LandlordId, IsAdmin = true, JoinedAt = clock.GetUtcNow().UtcDateTime });
            if (tenantUserId.HasValue && tenantUserId != request.Property.LandlordId)
                conversation.Participants.Add(new ConversationParticipant { UserId = tenantUserId.Value, JoinedAt = clock.GetUtcNow().UtcDateTime });
            db.Conversations.Add(conversation);
            await db.SaveChangesAsync(ct);
            direct = conversation.Id;
            request.ConversationId = direct;
        }
        if (!await db.ConversationContextLinks.AnyAsync(x => x.OrganizationId == request.OrganizationId && x.ConversationId == direct && x.MaintenanceRequestId == request.Id, ct))
        {
            db.ConversationContextLinks.Add(new ConversationContextLink
            {
                OrganizationId = request.OrganizationId.Value,
                ConversationId = direct.Value,
                MaintenanceRequestId = request.Id,
                CreatedAtUtc = clock.GetUtcNow().UtcDateTime
            });
            await db.SaveChangesAsync(ct);
        }
        return direct;
    }

    private async Task ReconcileVendorParticipantAsync(MaintenanceRequest request, long conversationId, CancellationToken ct)
    {
        var vendorUsers = await db.Vendors.Where(vendor => vendor.OrganizationId == request.OrganizationId && vendor.PortalUserId != null)
            .Select(vendor => vendor.PortalUserId!.Value).Distinct().ToListAsync(ct);
        var currentVendorUserId = request.AssignedToType == EAssignedToType.Vendor && request.VendorId.HasValue
            ? await db.Vendors.Where(vendor => vendor.Id == request.VendorId && vendor.OrganizationId == request.OrganizationId &&
                    vendor.IsActive && !vendor.IsDeleted)
                .Select(vendor => vendor.PortalUserId).SingleOrDefaultAsync(ct)
            : null;
        var participants = await db.ConversationParticipants
            .Where(participant => participant.ConversationId == conversationId && vendorUsers.Contains(participant.UserId)).ToListAsync(ct);
        var now = clock.GetUtcNow().UtcDateTime;
        foreach (var prior in participants.Where(participant => participant.UserId != currentVendorUserId && !participant.IsDeleted))
        {
            prior.IsDeleted = true;
            prior.DeletedAt = now;
            prior.LeftAt = now;
        }
        if (currentVendorUserId.HasValue)
        {
            var current = participants.SingleOrDefault(participant => participant.UserId == currentVendorUserId.Value);
            if (current is null)
                db.ConversationParticipants.Add(new ConversationParticipant
                {
                    ConversationId = conversationId, UserId = currentVendorUserId.Value, JoinedAt = now
                });
            else if (current.IsDeleted)
            {
                current.IsDeleted = false;
                current.DeletedAt = null;
                current.LeftAt = null;
                current.JoinedAt = now;
            }
        }
        await db.SaveChangesAsync(ct);
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}

public sealed class MaintenanceProjectionUnresolvedException(string errorCode) : InvalidOperationException(errorCode)
{
    public string ErrorCode { get; } = errorCode;
}
