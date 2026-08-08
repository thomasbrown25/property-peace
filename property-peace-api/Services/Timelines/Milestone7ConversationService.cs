using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Timeline;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Timelines;
using brownstone_hub_api.Repositories.Conversations;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Timelines;

public interface IMilestone7ConversationService
{
    Task<TimelineDtoPage> ReadTimelineAsync(long conversationId, long actorUserId, long? afterSequence, int take, CancellationToken ct = default);
    Task<TimelineSearchPage> SearchAsync(long actorUserId, TimelineSearchRequest request, CancellationToken ct = default);
    Task<UnreadStateDto> GetUnreadAsync(long conversationId, long actorUserId, CancellationToken ct = default);
    Task<UnreadStateDto> MarkReadAsync(long conversationId, long actorUserId, long? throughSequence, CancellationToken ct = default);
    Task<IReadOnlyList<QuickReplyDto>> ListQuickRepliesAsync(long actorUserId, long organizationId, string? contextKind, CancellationToken ct = default);
    Task<QuickReplyDto> CreateQuickReplyAsync(long actorUserId, SaveQuickReplyRequest request, CancellationToken ct = default);
    Task<QuickReplyDto> UpdateQuickReplyAsync(long actorUserId, long id, SaveQuickReplyRequest request, CancellationToken ct = default);
    Task DeleteQuickReplyAsync(long actorUserId, long id, CancellationToken ct = default);
    Task<GroupDto> CreateGroupAsync(long actorUserId, CreateGroupRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ParticipantDiscoveryDto>> DiscoverParticipantsAsync(long actorUserId, long organizationId, CancellationToken ct = default);
    Task AddGroupParticipantAsync(long actorUserId, long conversationId, long userId, CancellationToken ct = default);
    Task RemoveGroupParticipantAsync(long actorUserId, long conversationId, long userId, CancellationToken ct = default);
    Task LeaveGroupAsync(long actorUserId, long conversationId, CancellationToken ct = default);
    Task<FollowUpTaskDto> CreateFollowUpAsync(long actorUserId, SaveFollowUpTaskRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<FollowUpTaskDto>> ListFollowUpsAsync(long actorUserId, long organizationId, long? conversationId, CancellationToken ct = default);
    Task<FollowUpTaskDto> GetFollowUpAsync(long actorUserId, long id, CancellationToken ct = default);
    Task<FollowUpTaskDto> UpdateFollowUpAsync(long actorUserId, long id, SaveFollowUpTaskRequest request, byte[] rowVersion, CancellationToken ct = default);
    Task<FollowUpTaskDto> CompleteFollowUpAsync(long actorUserId, long id, byte[] rowVersion, CancellationToken ct = default);
    Task DeleteFollowUpAsync(long actorUserId, long id, byte[] rowVersion, CancellationToken ct = default);
}

public sealed class Milestone7ConversationService(
    DataContext db,
    IConversationTimelineRepository timeline,
    TimeProvider clock) : IMilestone7ConversationService
{
    private static readonly HashSet<string> PublicMetadataKeys = new(StringComparer.Ordinal)
    {
        "status", "amount", "attachmentName", "replyToMessageId", "maintenanceStatus", "channel", "direction",
        "reminderType", "screeningStatus", "leaseStatus", "paymentStatus", "percyAction", "followUpStatus",
        "reason", "fromStatus", "toStatus"
    };
    private static readonly HashSet<string> ContextKinds = new(StringComparer.OrdinalIgnoreCase)
        { "property", "unit", "listing", "lead", "rentalApplication", "lease", "payment", "maintenance" };

    public async Task<TimelineDtoPage> ReadTimelineAsync(long conversationId, long actorUserId, long? afterSequence, int take, CancellationToken ct = default)
    {
        if (take is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(take));
        var page = await timeline.ReadAsync(conversationId, actorUserId, afterSequence, take, ct);
        return new TimelineDtoPage(await ProjectAsync(page.Items, ct), page.NextCursor);
    }

    public async Task<TimelineSearchPage> SearchAsync(long actorUserId, TimelineSearchRequest request, CancellationToken ct = default)
    {
        if (request.Take is < 1 or > 100 || request.Skip is < 0 or > 10_000) throw new ArgumentOutOfRangeException(nameof(request.Take));
        if (request.FromUtc.HasValue && request.ToUtc.HasValue && request.FromUtc > request.ToUtc) throw new ArgumentException("Invalid date range.");

        // Resolve an explicitly supplied conversation first and deliberately collapse inaccessible and absent to 404.
        if (request.ConversationId.HasValue && !await IsActiveParticipantAsync(request.ConversationId.Value, actorUserId, ct))
            throw new KeyNotFoundException("Conversation not found");

        var visibleConversationIds = db.Conversations.WhereActiveParticipant(db.OrganizationMembers, actorUserId).Select(c => c.Id);
        var query = db.ConversationTimelineEntries.AsNoTracking().Where(e => visibleConversationIds.Contains(e.ConversationId));
        if (request.OrganizationId.HasValue) query = query.Where(e => e.OrganizationId == request.OrganizationId.Value);
        if (request.ConversationId.HasValue) query = query.Where(e => e.ConversationId == request.ConversationId.Value);
        if (request.ContextKind != null) query = query.Where(e => e.ContextKind == request.ContextKind.ToLower());
        if (request.ContextId.HasValue) query = query.Where(e => e.ContextId == request.ContextId);
        if (request.Kinds is { Count: > 0 }) query = query.Where(e => request.Kinds.Contains(e.Kind));
        if (request.FromUtc.HasValue) query = query.Where(e => e.OccurredAtUtc >= request.FromUtc);
        if (request.ToUtc.HasValue) query = query.Where(e => e.OccurredAtUtc <= request.ToUtc);

        var staffOrganizations = db.OrganizationMembers.Where(m => m.UserId == actorUserId && m.IsActive).Select(m => m.OrganizationId);
        query = query.Where(e => e.Visibility != TimelineVisibility.StaffOnly || staffOrganizations.Contains(e.OrganizationId));
        var participantFloors = db.ConversationParticipants.Where(p => p.UserId == actorUserId && !p.IsDeleted && p.StaffVisibilityFromSequence.HasValue);
        query = query.Where(e => e.Visibility != TimelineVisibility.StaffOnly ||
            !participantFloors.Any(p => p.ConversationId == e.ConversationId) ||
            participantFloors.Any(p => p.ConversationId == e.ConversationId && e.Sequence >= p.StaffVisibilityFromSequence));

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            var term = request.Query.Trim();
            query = query.Where(e => e.Summary.Contains(term) ||
                (e.MessageId.HasValue && db.Messages.Any(m => m.Id == e.MessageId && !m.IsDeleted && m.Content.Contains(term))));
        }

        // JSON metadata is parsed only after all authorization, organization, context, kind and date predicates.
        var candidates = await query.OrderByDescending(e => e.OccurredAtUtc).ThenByDescending(e => e.Sequence).ToListAsync(ct);
        var filtered = candidates.Where(e => MetadataMatches(e.MetadataJson, request.Channel, request.Status))
            .Skip(request.Skip).Take(request.Take).ToList();
        return new TimelineSearchPage(await ProjectAsync(filtered, ct), request.Skip, request.Take);
    }

    public async Task<UnreadStateDto> GetUnreadAsync(long conversationId, long actorUserId, CancellationToken ct = default)
    {
        var visible = await VisibleQueryAsync(conversationId, actorUserId, ct);
        var latest = await visible.Select(e => (long?)e.Sequence).MaxAsync(ct) ?? 0;
        var lastRead = await db.ConversationReadWatermarks.Where(x => x.ConversationId == conversationId && x.UserId == actorUserId)
            .Select(x => (long?)x.LastReadSequence).SingleOrDefaultAsync(ct) ?? 0;
        var count = await visible.CountAsync(e => e.Sequence > lastRead &&
            (!e.ActorUserId.HasValue || e.ActorUserId.Value != actorUserId), ct);
        return new UnreadStateDto(conversationId, lastRead, latest, count);
    }

    public async Task<UnreadStateDto> MarkReadAsync(long conversationId, long actorUserId, long? throughSequence, CancellationToken ct = default)
    {
        var visible = await VisibleQueryAsync(conversationId, actorUserId, ct);
        var latest = await visible.Select(e => (long?)e.Sequence).MaxAsync(ct) ?? 0;
        var requested = Math.Clamp(throughSequence ?? latest, 0, latest);
        var watermark = await db.ConversationReadWatermarks.SingleOrDefaultAsync(x => x.ConversationId == conversationId && x.UserId == actorUserId, ct);
        if (watermark == null)
        {
            watermark = new ConversationReadWatermark { ConversationId = conversationId, UserId = actorUserId };
            db.ConversationReadWatermarks.Add(watermark);
        }
        watermark.LastReadSequence = Math.Max(watermark.LastReadSequence, requested);
        watermark.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        return await GetUnreadAsync(conversationId, actorUserId, ct);
    }

    public async Task<IReadOnlyList<QuickReplyDto>> ListQuickRepliesAsync(long actorUserId, long organizationId, string? contextKind, CancellationToken ct = default)
    {
        await RequireOrganizationAccessAsync(actorUserId, organizationId, ct);
        return await db.QuickReplies.AsNoTracking()
            .Where(x => x.OrganizationId == organizationId && (x.OwnerUserId == null || x.OwnerUserId == actorUserId) &&
                        (contextKind == null || x.ContextKind == null || x.ContextKind == contextKind))
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Title)
            .Select(x => new QuickReplyDto(x.Id, x.OrganizationId, x.OwnerUserId, x.Title, x.Body, x.SortOrder, x.IsActive, x.ContextKind)).ToListAsync(ct);
    }

    public async Task<QuickReplyDto> CreateQuickReplyAsync(long actorUserId, SaveQuickReplyRequest request, CancellationToken ct = default)
    {
        ValidateQuickReply(request);
        var isStaff = await IsStaffAsync(actorUserId, request.OrganizationId, ct);
        if (isStaff)
        {
            if (request.OwnerUserId.HasValue &&
                !await IsEligibleParticipantAsync(request.OwnerUserId.Value, request.OrganizationId, ct))
                throw new KeyNotFoundException("Quick reply owner not found");
        }
        else
        {
            await RequireOrganizationAccessAsync(actorUserId, request.OrganizationId, ct);
            if (request.OwnerUserId != actorUserId) throw new KeyNotFoundException("Organization not found");
        }
        var now = clock.GetUtcNow().UtcDateTime;
        var entity = new QuickReply { OrganizationId = request.OrganizationId, OwnerUserId = request.OwnerUserId,
            Title = request.Title.Trim(), Body = request.Body.Trim(), SortOrder = request.SortOrder, IsActive = request.IsActive,
            ContextKind = request.ContextKind?.Trim(), CreatedAtUtc = now, UpdatedAtUtc = now };
        db.QuickReplies.Add(entity);
        await db.SaveChangesAsync(ct);
        return QuickDto(entity);
    }

    public async Task<QuickReplyDto> UpdateQuickReplyAsync(long actorUserId, long id, SaveQuickReplyRequest request, CancellationToken ct = default)
    {
        ValidateQuickReply(request);
        var entity = await db.QuickReplies.SingleOrDefaultAsync(x => x.Id == id && x.OrganizationId == request.OrganizationId, ct)
            ?? throw new KeyNotFoundException("Quick reply not found");
        var isStaff = await IsStaffAsync(actorUserId, entity.OrganizationId, ct);
        if (isStaff)
        {
            if (request.OwnerUserId.HasValue &&
                !await IsEligibleParticipantAsync(request.OwnerUserId.Value, entity.OrganizationId, ct))
                throw new KeyNotFoundException("Quick reply owner not found");
        }
        else
        {
            await RequireOrganizationAccessAsync(actorUserId, entity.OrganizationId, ct);
            if (entity.OwnerUserId != actorUserId || request.OwnerUserId != actorUserId)
                throw new KeyNotFoundException("Quick reply not found");
        }
        entity.OwnerUserId = request.OwnerUserId; entity.Title = request.Title.Trim(); entity.Body = request.Body.Trim();
        entity.SortOrder = request.SortOrder; entity.IsActive = request.IsActive; entity.ContextKind = request.ContextKind?.Trim();
        entity.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        return QuickDto(entity);
    }

    public async Task DeleteQuickReplyAsync(long actorUserId, long id, CancellationToken ct = default)
    {
        var entity = await db.QuickReplies.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException("Quick reply not found");
        if (entity.OwnerUserId != actorUserId && !await IsStaffAsync(actorUserId, entity.OrganizationId, ct)) throw new KeyNotFoundException("Quick reply not found");
        db.QuickReplies.Remove(entity); await db.SaveChangesAsync(ct);
    }

    public async Task<GroupDto> CreateGroupAsync(long actorUserId, CreateGroupRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 100) throw new ArgumentException("Invalid group title.");
        await RequireStaffAsync(actorUserId, request.OrganizationId, ct);
        var participantIds = request.ParticipantUserIds.Append(actorUserId).Distinct().ToList();
        foreach (var id in participantIds)
            if (!await IsEligibleParticipantAsync(id, request.OrganizationId, ct)) throw new KeyNotFoundException("Participant not found");
        var conversation = new Conversation { OrganizationId = request.OrganizationId, LandlordId = actorUserId,
            Title = request.Title.Trim(), IsGroupChat = true, CreatedBy = actorUserId, CreatedAt = clock.GetUtcNow().UtcDateTime };
        db.Conversations.Add(conversation); await db.SaveChangesAsync(ct);
        db.ConversationParticipants.AddRange(participantIds.Select(id => new ConversationParticipant
            { ConversationId = conversation.Id, UserId = id, IsAdmin = id == actorUserId, StaffVisibilityFromSequence = 1 }));
        await db.SaveChangesAsync(ct);
        await AuditAsync(conversation, actorUserId, "group-created", $"Group created: {conversation.Title}", ct);
        return await GroupDtoAsync(conversation.Id, ct);
    }

    public async Task<IReadOnlyList<ParticipantDiscoveryDto>> DiscoverParticipantsAsync(long actorUserId, long organizationId, CancellationToken ct = default)
    {
        await RequireStaffAsync(actorUserId, organizationId, ct);
        var staff = db.OrganizationMembers.Where(m => m.OrganizationId == organizationId && m.IsActive && m.UserId.HasValue).Select(m => m.UserId!.Value);
        var participants = db.ConversationParticipants.Where(p => !p.IsDeleted && p.Conversation.OrganizationId == organizationId).Select(p => p.UserId);
        var ids = staff.Union(participants);
        return await db.Users.Where(u => ids.Contains(u.Id) && !u.IsDeleted).OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new ParticipantDiscoveryDto(u.Id, (u.FirstName + " " + u.LastName).Trim(), staff.Contains(u.Id))).ToListAsync(ct);
    }

    public async Task AddGroupParticipantAsync(long actorUserId, long conversationId, long userId, CancellationToken ct = default)
    {
        var conversation = await RequireGroupManagerAsync(actorUserId, conversationId, ct);
        if (!await IsEligibleParticipantAsync(userId, conversation.OrganizationId!.Value, ct)) throw new KeyNotFoundException("Participant not found");
        var currentMax = await db.ConversationTimelineEntries.Where(e => e.ConversationId == conversationId).Select(e => (long?)e.Sequence).MaxAsync(ct) ?? 0;
        var participant = await db.ConversationParticipants.SingleOrDefaultAsync(p => p.ConversationId == conversationId && p.UserId == userId, ct);
        if (participant == null) db.ConversationParticipants.Add(new ConversationParticipant { ConversationId = conversationId, UserId = userId, StaffVisibilityFromSequence = currentMax + 1 });
        else { participant.IsDeleted = false; participant.DeletedAt = null; participant.LeftAt = null; participant.JoinedAt = clock.GetUtcNow().UtcDateTime; participant.StaffVisibilityFromSequence = currentMax + 1; }
        await db.SaveChangesAsync(ct); await AuditAsync(conversation, actorUserId, $"participant-added-{userId}-{currentMax + 1}", "Participant added", ct);
    }

    public async Task RemoveGroupParticipantAsync(long actorUserId, long conversationId, long userId, CancellationToken ct = default)
    {
        var conversation = await RequireGroupManagerAsync(actorUserId, conversationId, ct);
        var participant = await db.ConversationParticipants.SingleOrDefaultAsync(p => p.ConversationId == conversationId && p.UserId == userId && !p.IsDeleted, ct)
            ?? throw new KeyNotFoundException("Participant not found");
        if (participant.IsAdmin && !await IsStaffAsync(actorUserId, conversation.OrganizationId!.Value, ct)) throw new InvalidOperationException("Only staff can remove a group admin.");
        participant.IsDeleted = true; participant.DeletedAt = participant.LeftAt = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct); await AuditAsync(conversation, actorUserId, $"participant-removed-{userId}-{Guid.NewGuid():N}", "Participant removed", ct);
    }

    public async Task LeaveGroupAsync(long actorUserId, long conversationId, CancellationToken ct = default)
    {
        var conversation = await db.Conversations.SingleOrDefaultAsync(c => c.Id == conversationId && c.IsGroupChat && c.Participants.Any(p => p.UserId == actorUserId && !p.IsDeleted), ct)
            ?? throw new KeyNotFoundException("Conversation not found");
        var participant = await db.ConversationParticipants.SingleAsync(p => p.ConversationId == conversationId && p.UserId == actorUserId && !p.IsDeleted, ct);
        if (participant.IsAdmin && !await db.ConversationParticipants.AnyAsync(p => p.ConversationId == conversationId && !p.IsDeleted && p.UserId != actorUserId && p.IsAdmin, ct))
            throw new InvalidOperationException("Assign another group admin before leaving.");
        await AuditAsync(conversation, actorUserId, $"participant-left-{actorUserId}-{Guid.NewGuid():N}", "Participant left", ct);
        participant.IsDeleted = true; participant.LeftAt = participant.DeletedAt = clock.GetUtcNow().UtcDateTime; await db.SaveChangesAsync(ct);
    }

    public async Task<FollowUpTaskDto> CreateFollowUpAsync(long actorUserId, SaveFollowUpTaskRequest request, CancellationToken ct = default)
    {
        ValidateFollowUp(request); await RequireStaffAsync(actorUserId, request.OrganizationId, ct);
        var existing = await db.ConversationFollowUpTasks.SingleOrDefaultAsync(x => x.OrganizationId == request.OrganizationId && x.IdempotencyKey == request.IdempotencyKey, ct);
        if (existing != null)
        {
            if (!SameFollowUp(existing, request)) throw new TimelineIdempotencyConflictException("Follow-up key already used for another payload.");
            return FollowUpDto(existing);
        }
        await ValidateFollowUpLinksAsync(request, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        var entity = new ConversationFollowUpTask { OrganizationId = request.OrganizationId, ConversationId = request.ConversationId,
            TimelineEntryId = request.TimelineEntryId, ContextKind = request.ContextKind, ContextId = request.ContextId,
            AssigneeUserId = request.AssigneeUserId, Title = request.Title.Trim(), DueAtUtc = request.DueAtUtc,
            Status = FollowUpTaskStatus.Open, IdempotencyKey = request.IdempotencyKey.Trim(), CreatedByUserId = actorUserId,
            CreatedAtUtc = now, UpdatedAtUtc = now, RowVersion = Guid.NewGuid().ToByteArray() };
        db.ConversationFollowUpTasks.Add(entity); await db.SaveChangesAsync(ct);
        await FollowUpAuditAsync(entity, actorUserId, "created", ct); return FollowUpDto(entity);
    }

    public async Task<IReadOnlyList<FollowUpTaskDto>> ListFollowUpsAsync(long actorUserId, long organizationId, long? conversationId, CancellationToken ct = default)
    {
        await RequireStaffAsync(actorUserId, organizationId, ct);
        if (conversationId.HasValue && !await db.Conversations.AnyAsync(c => c.Id == conversationId && c.OrganizationId == organizationId && c.Participants.Any(p => p.UserId == actorUserId && !p.IsDeleted), ct))
            throw new KeyNotFoundException("Conversation not found");
        return await db.ConversationFollowUpTasks.AsNoTracking().Where(x => x.OrganizationId == organizationId && (!conversationId.HasValue || x.ConversationId == conversationId))
            .OrderBy(x => x.DueAtUtc).Select(x => FollowUpProjection(x)).ToListAsync(ct);
    }

    public async Task<FollowUpTaskDto> GetFollowUpAsync(long actorUserId, long id, CancellationToken ct = default)
    {
        var entity = await db.ConversationFollowUpTasks.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException("Follow-up not found");
        await RequireStaffAsync(actorUserId, entity.OrganizationId, ct); return FollowUpDto(entity);
    }

    public async Task<FollowUpTaskDto> UpdateFollowUpAsync(long actorUserId, long id, SaveFollowUpTaskRequest request, byte[] rowVersion, CancellationToken ct = default)
    {
        ValidateFollowUp(request); await RequireStaffAsync(actorUserId, request.OrganizationId, ct);
        var entity = await db.ConversationFollowUpTasks.SingleOrDefaultAsync(x => x.Id == id && x.OrganizationId == request.OrganizationId, ct) ?? throw new KeyNotFoundException("Follow-up not found");
        RequireVersion(entity, rowVersion); await ValidateFollowUpLinksAsync(request, ct);
        entity.ConversationId = request.ConversationId; entity.TimelineEntryId = request.TimelineEntryId; entity.ContextKind = request.ContextKind;
        entity.ContextId = request.ContextId; entity.AssigneeUserId = request.AssigneeUserId; entity.Title = request.Title.Trim(); entity.DueAtUtc = request.DueAtUtc;
        Bump(entity); await db.SaveChangesAsync(ct); await FollowUpAuditAsync(entity, actorUserId, "updated", ct); return FollowUpDto(entity);
    }

    public async Task<FollowUpTaskDto> CompleteFollowUpAsync(long actorUserId, long id, byte[] rowVersion, CancellationToken ct = default)
    {
        var entity = await db.ConversationFollowUpTasks.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException("Follow-up not found");
        await RequireStaffAsync(actorUserId, entity.OrganizationId, ct); RequireVersion(entity, rowVersion);
        entity.Status = FollowUpTaskStatus.Completed; entity.CompletedAtUtc = clock.GetUtcNow().UtcDateTime; Bump(entity);
        await db.SaveChangesAsync(ct); await FollowUpAuditAsync(entity, actorUserId, "completed", ct); return FollowUpDto(entity);
    }

    public async Task DeleteFollowUpAsync(long actorUserId, long id, byte[] rowVersion, CancellationToken ct = default)
    {
        var entity = await db.ConversationFollowUpTasks.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException("Follow-up not found");
        await RequireStaffAsync(actorUserId, entity.OrganizationId, ct); RequireVersion(entity, rowVersion);
        entity.Status = FollowUpTaskStatus.Cancelled; Bump(entity); await db.SaveChangesAsync(ct); await FollowUpAuditAsync(entity, actorUserId, "cancelled", ct);
    }

    private async Task<IQueryable<ConversationTimelineEntry>> VisibleQueryAsync(long conversationId, long actorUserId, CancellationToken ct)
    {
        var authorized = await db.Conversations.WhereActiveParticipant(db.OrganizationMembers, actorUserId)
            .Where(c => c.Id == conversationId)
            .Select(c => new { OrganizationId = c.OrganizationId!.Value,
                Floor = c.Participants.Where(p => p.UserId == actorUserId && !p.IsDeleted)
                    .Select(p => p.StaffVisibilityFromSequence).FirstOrDefault() })
            .SingleOrDefaultAsync(ct) ?? throw new KeyNotFoundException("Conversation not found");
        var org = authorized.OrganizationId;
        var staff = await IsStaffAsync(actorUserId, org, ct);
        var query = db.ConversationTimelineEntries.AsNoTracking().Where(e => e.ConversationId == conversationId);
        if (!staff) query = query.Where(e => e.Visibility != TimelineVisibility.StaffOnly);
        else if (authorized.Floor.HasValue)
            query = query.Where(e => e.Visibility != TimelineVisibility.StaffOnly || e.Sequence >= authorized.Floor);
        return query;
    }

    private async Task<IReadOnlyList<TimelineItemDto>> ProjectAsync(IReadOnlyCollection<ConversationTimelineEntry> entries, CancellationToken ct)
    {
        if (entries.Count == 0) return [];
        var ids = entries.Select(e => e.Id).ToList();
        var deliveries = await db.MessageDeliveries.AsNoTracking().Where(d => ids.Contains(d.ConversationTimelineEntryId))
            .Select(d => new { d.ConversationTimelineEntryId, d.Channel, d.Status, d.MaskedDestination, d.SubmittedAtUtc, d.DeliveredAtUtc, d.FailedAtUtc }).ToListAsync(ct);
        return entries.Select(e => new TimelineItemDto(e.Id, e.ConversationId, e.Sequence, Camel(e.Kind), e.OccurredAtUtc,
            e.ActorUserId, e.Summary, e.MetadataVersion, ParseMetadata(e.MetadataJson),
            e.ContextId.HasValue && e.ContextKind != null && e.ContextLabel != null ? new TimelineContextDto(e.ContextKind, e.ContextId.Value, e.ContextLabel) : null,
            Camel(e.Visibility), deliveries.Where(d => d.ConversationTimelineEntryId == e.Id)
                .Select(d => new DeliverySummaryDto(Camel(d.Channel), Camel(d.Status), d.MaskedDestination, d.SubmittedAtUtc, d.DeliveredAtUtc, d.FailedAtUtc)).ToList())).ToList();
    }

    private static IReadOnlyDictionary<string, string> ParseMetadata(string json)
    {
        try
        {
            var values = JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? [];
            return values.Where(x => PublicMetadataKeys.Contains(x.Key)).ToDictionary(x => x.Key, x => x.Value, StringComparer.Ordinal);
        }
        catch (JsonException) { return new Dictionary<string, string>(); }
    }

    private static bool MetadataMatches(string json, string? channel, string? status)
    {
        var metadata = ParseMetadata(json);
        return (channel == null || metadata.TryGetValue("channel", out var c) && string.Equals(c, channel, StringComparison.OrdinalIgnoreCase)) &&
               (status == null || metadata.TryGetValue("status", out var s) && string.Equals(s, status, StringComparison.OrdinalIgnoreCase));
    }

    private async Task<bool> IsActiveParticipantAsync(long conversationId, long userId, CancellationToken ct) =>
        await db.Conversations.WhereActiveParticipant(db.OrganizationMembers, userId).AnyAsync(c => c.Id == conversationId, ct);
    private async Task<bool> IsStaffAsync(long userId, long organizationId, CancellationToken ct) =>
        await db.OrganizationMembers.AnyAsync(m => m.OrganizationId == organizationId && m.UserId == userId && m.IsActive, ct);
    private async Task RequireStaffAsync(long userId, long organizationId, CancellationToken ct)
    { if (!await IsStaffAsync(userId, organizationId, ct)) throw new KeyNotFoundException("Organization not found"); }
    private async Task RequireOrganizationAccessAsync(long userId, long organizationId, CancellationToken ct)
    {
        if (!await IsStaffAsync(userId, organizationId, ct) &&
            !await db.ConversationParticipants.AnyAsync(p => p.UserId == userId && !p.IsDeleted && p.Conversation.OrganizationId == organizationId, ct))
            throw new KeyNotFoundException("Organization not found");
    }
    private async Task<bool> IsEligibleParticipantAsync(long userId, long organizationId, CancellationToken ct) =>
        await db.OrganizationMembers.AnyAsync(m => m.OrganizationId == organizationId && m.UserId == userId && m.IsActive, ct) ||
        await db.ConversationParticipants.AnyAsync(p => p.UserId == userId && !p.IsDeleted && p.Conversation.OrganizationId == organizationId, ct);

    private async Task<Conversation> RequireGroupManagerAsync(long actorUserId, long conversationId, CancellationToken ct)
    {
        var conversation = await db.Conversations.SingleOrDefaultAsync(c => c.Id == conversationId && c.IsGroupChat && c.OrganizationId.HasValue &&
            c.Participants.Any(p => p.UserId == actorUserId && !p.IsDeleted), ct) ?? throw new KeyNotFoundException("Conversation not found");
        var admin = await db.ConversationParticipants.AnyAsync(p => p.ConversationId == conversationId && p.UserId == actorUserId && !p.IsDeleted && p.IsAdmin, ct);
        if (!admin && !await IsStaffAsync(actorUserId, conversation.OrganizationId!.Value, ct)) throw new KeyNotFoundException("Conversation not found");
        return conversation;
    }

    private async Task<GroupDto> GroupDtoAsync(long id, CancellationToken ct)
    {
        var value = await db.Conversations.Where(c => c.Id == id).Select(c => new { c.Id, OrganizationId = c.OrganizationId!.Value, c.Title }).SingleAsync(ct);
        var ids = await db.ConversationParticipants.Where(p => p.ConversationId == id && !p.IsDeleted).Select(p => p.UserId).OrderBy(x => x).ToListAsync(ct);
        return new GroupDto(value.Id, value.OrganizationId, value.Title, ids);
    }

    private async Task AuditAsync(Conversation conversation, long actor, string eventId, string summary, CancellationToken ct) =>
        await timeline.AppendAsync(new AppendTimelineEntryRequest { OrganizationId = conversation.OrganizationId!.Value, ConversationId = conversation.Id,
            Kind = TimelineEntryKind.System, OccurredAtUtc = clock.GetUtcNow().UtcDateTime, ActorUserId = actor, SourceType = "group",
            SourceId = conversation.Id.ToString(), Summary = summary, Metadata = new Dictionary<string, string> { ["status"] = eventId.Split('-')[0] },
            Visibility = TimelineVisibility.Participants, Producer = "group-api", EventId = eventId, PayloadHash = Hash($"{conversation.Id}:{eventId}:{summary}") }, ct);

    private async Task FollowUpAuditAsync(ConversationFollowUpTask task, long actor, string action, CancellationToken ct) =>
        await timeline.AppendAsync(new AppendTimelineEntryRequest { OrganizationId = task.OrganizationId, ConversationId = task.ConversationId,
            Kind = TimelineEntryKind.PercyFollowUp, OccurredAtUtc = clock.GetUtcNow().UtcDateTime, ActorUserId = actor,
            SourceType = "followUp", SourceId = task.Id.ToString(), Summary = $"Follow-up {action}: {task.Title}",
            Metadata = new Dictionary<string, string> { ["followUpStatus"] = action }, ContextKind = task.ContextKind,
            ContextId = task.ContextId, ContextLabel = $"{task.ContextKind} {task.ContextId}", Visibility = TimelineVisibility.StaffOnly,
            Producer = "follow-up-api", EventId = $"{task.Id}:{action}:{Convert.ToHexString(task.RowVersion)}", PayloadHash = Hash($"{task.Id}:{action}:{task.Title}:{Convert.ToHexString(task.RowVersion)}") }, ct);

    private async Task ValidateFollowUpLinksAsync(SaveFollowUpTaskRequest request, CancellationToken ct)
    {
        var validTimeline = await db.ConversationTimelineEntries.AnyAsync(e => e.Id == request.TimelineEntryId && e.OrganizationId == request.OrganizationId &&
            e.ConversationId == request.ConversationId && e.ContextKind == request.ContextKind && e.ContextId == request.ContextId, ct);
        var validConversation = await db.Conversations.AnyAsync(c => c.Id == request.ConversationId && c.OrganizationId == request.OrganizationId, ct);
        var validAssignee = await IsStaffAsync(request.AssigneeUserId, request.OrganizationId, ct);
        if (!validTimeline || !validConversation || !validAssignee) throw new KeyNotFoundException("Follow-up context not found");
    }

    private static void ValidateQuickReply(SaveQuickReplyRequest x)
    {
        if (x.OrganizationId <= 0 || string.IsNullOrWhiteSpace(x.Title) || x.Title.Length > 100 || string.IsNullOrWhiteSpace(x.Body) || x.Body.Length > 2000 ||
            x.SortOrder is < -10_000 or > 10_000 || x.ContextKind != null && !ContextKinds.Contains(x.ContextKind)) throw new ArgumentException("Invalid quick reply.");
    }
    private static void ValidateFollowUp(SaveFollowUpTaskRequest x)
    {
        if (x.OrganizationId <= 0 || x.ConversationId <= 0 || x.TimelineEntryId <= 0 || x.ContextId <= 0 || !ContextKinds.Contains(x.ContextKind) ||
            x.AssigneeUserId <= 0 || string.IsNullOrWhiteSpace(x.Title) || x.Title.Length > 200 || x.DueAtUtc.Kind != DateTimeKind.Utc ||
            string.IsNullOrWhiteSpace(x.IdempotencyKey) || x.IdempotencyKey.Length > 100) throw new ArgumentException("Invalid follow-up.");
    }
    private static bool SameFollowUp(ConversationFollowUpTask x, SaveFollowUpTaskRequest y) => x.ConversationId == y.ConversationId &&
        x.TimelineEntryId == y.TimelineEntryId && x.ContextKind == y.ContextKind && x.ContextId == y.ContextId && x.AssigneeUserId == y.AssigneeUserId &&
        x.Title == y.Title.Trim() && x.DueAtUtc == y.DueAtUtc;
    private static void RequireVersion(ConversationFollowUpTask task, byte[] supplied)
    { if (supplied == null || !task.RowVersion.SequenceEqual(supplied)) throw new DbUpdateConcurrencyException("Follow-up was changed by another request."); }
    private void Bump(ConversationFollowUpTask entity) { entity.RowVersion = Guid.NewGuid().ToByteArray(); entity.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime; }
    private static QuickReplyDto QuickDto(QuickReply x) => new(x.Id, x.OrganizationId, x.OwnerUserId, x.Title, x.Body, x.SortOrder, x.IsActive, x.ContextKind);
    private static FollowUpTaskDto FollowUpDto(ConversationFollowUpTask x) => new(x.Id, x.OrganizationId, x.ConversationId, x.TimelineEntryId,
        new TimelineContextDto(x.ContextKind, x.ContextId, $"{x.ContextKind} {x.ContextId}"), x.AssigneeUserId, x.Title, x.DueAtUtc, Camel(x.Status), x.CompletedAtUtc, x.RowVersion.ToArray());
    private static FollowUpTaskDto FollowUpProjection(ConversationFollowUpTask x) => new(x.Id, x.OrganizationId, x.ConversationId, x.TimelineEntryId,
        new TimelineContextDto(x.ContextKind, x.ContextId, x.ContextKind + " " + x.ContextId), x.AssigneeUserId, x.Title, x.DueAtUtc,
        x.Status == FollowUpTaskStatus.Open ? "open" : x.Status == FollowUpTaskStatus.Completed ? "completed" : "cancelled", x.CompletedAtUtc, x.RowVersion);
    private static string Camel<T>(T value) where T : Enum { var s = value.ToString(); return char.ToLowerInvariant(s[0]) + s[1..]; }
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
