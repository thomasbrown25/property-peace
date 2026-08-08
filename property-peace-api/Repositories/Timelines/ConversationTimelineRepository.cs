using System.Text.Json;
using System.Text.RegularExpressions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Timeline;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Conversations;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Timelines;

public sealed class TimelineIdempotencyConflictException(string message) : InvalidOperationException(message);

public interface IConversationTimelineRepository
{
    Task<ConversationTimelineEntry> AppendAsync(AppendTimelineEntryRequest request, CancellationToken cancellationToken = default);
    Task<TimelinePage> ReadAsync(long conversationId, long actorUserId, long? afterSequence, int take, CancellationToken cancellationToken = default);
}

public sealed class ConversationTimelineRepository(
    DataContext context,
    ILogger<ConversationTimelineRepository> logger,
    IConversationTimelineSequenceAllocator sequenceAllocator) : IConversationTimelineRepository
{
    private static readonly HashSet<string> MetadataV1Keys = new(StringComparer.Ordinal)
    {
        "status", "amount", "attachmentName", "replyToMessageId", "maintenanceStatus",
        "channel", "direction", "reminderType", "screeningStatus", "leaseStatus", "paymentStatus",
        "percyAction", "followUpStatus", "reason", "fromStatus", "toStatus"
    };

    public async Task<ConversationTimelineEntry> AppendAsync(AppendTimelineEntryRequest request, CancellationToken cancellationToken = default)
    {
        Validate(request);
        var conversationExists = await context.Conversations.AnyAsync(x =>
            x.Id == request.ConversationId && x.OrganizationId == request.OrganizationId, cancellationToken);
        if (!conversationExists)
            throw new KeyNotFoundException("Conversation not found");

        await ValidateContextOwnershipAsync(request, cancellationToken);

        var existing = await context.ConversationTimelineEntries.SingleOrDefaultAsync(x =>
            x.OrganizationId == request.OrganizationId && x.Producer == request.Producer && x.EventId == request.EventId,
            cancellationToken);
        if (existing != null)
        {
            if (!string.Equals(existing.PayloadHash, request.PayloadHash, StringComparison.Ordinal))
                throw new TimelineIdempotencyConflictException("Producer event was already recorded with a different payload hash.");
            return existing;
        }

        var sequence = await sequenceAllocator.AllocateAsync(context, request.ConversationId, cancellationToken);
        var entry = new ConversationTimelineEntry
        {
            OrganizationId = request.OrganizationId,
            ConversationId = request.ConversationId,
            Sequence = sequence,
            Kind = request.Kind,
            OccurredAtUtc = request.OccurredAtUtc,
            RecordedAtUtc = DateTime.UtcNow,
            ActorUserId = request.ActorUserId,
            MessageId = request.MessageId,
            SourceType = request.SourceType.Trim(),
            SourceId = request.SourceId.Trim(),
            Summary = request.Summary.Trim(),
            MetadataVersion = request.MetadataVersion,
            MetadataJson = SerializeMetadata(request.Metadata),
            ContextKind = request.ContextKind?.Trim().ToLowerInvariant(),
            ContextId = request.ContextId,
            ContextLabel = request.ContextLabel?.Trim(),
            Visibility = request.Visibility,
            Producer = request.Producer.Trim(),
            EventId = request.EventId.Trim(),
            PayloadHash = request.PayloadHash
        };
        context.ConversationTimelineEntries.Add(entry);
        try
        {
            await context.SaveChangesAsync(cancellationToken);
            return entry;
        }
        catch (DbUpdateConcurrencyException ex)
        {
            logger.LogWarning(ex, "Concurrent timeline append for conversation {ConversationId}", request.ConversationId);
            throw;
        }
    }

    public async Task<TimelinePage> ReadAsync(
        long conversationId,
        long actorUserId,
        long? afterSequence,
        int take,
        CancellationToken cancellationToken = default)
    {
        if (take is < 1 or > 100) throw new ArgumentOutOfRangeException(nameof(take));
        var conversation = await context.Conversations.WhereActiveParticipant(context.OrganizationMembers, actorUserId)
            .Where(x => x.Id == conversationId)
            .Select(x => new { x.OrganizationId, Participant = x.Participants.Where(p => p.UserId == actorUserId && !p.IsDeleted).Select(p => p.StaffVisibilityFromSequence).FirstOrDefault() })
            .SingleOrDefaultAsync(cancellationToken);
        if (conversation == null) throw new KeyNotFoundException("Conversation not found");

        var isStaff = conversation.OrganizationId.HasValue && await context.OrganizationMembers.AnyAsync(x =>
            x.OrganizationId == conversation.OrganizationId.Value && x.UserId == actorUserId && x.IsActive,
            cancellationToken);

        var query = context.ConversationTimelineEntries.AsNoTracking().Where(x => x.ConversationId == conversationId);
        if (!isStaff) query = query.Where(x => x.Visibility != TimelineVisibility.StaffOnly);
        else if (conversation.Participant.HasValue)
            query = query.Where(x => x.Visibility != TimelineVisibility.StaffOnly || x.Sequence >= conversation.Participant.Value);

        // The cursor is the exclusive upper sequence bound for historical paging. Fetch one
        // extra row so a full final page does not incorrectly advertise another page.
        if (afterSequence.HasValue) query = query.Where(x => x.Sequence < afterSequence.Value);
        var descending = await query.OrderByDescending(x => x.Sequence).Take(take + 1).ToListAsync(cancellationToken);
        var hasOlder = descending.Count > take;
        if (hasOlder) descending.RemoveAt(descending.Count - 1);
        descending.Reverse();

        return new TimelinePage
        {
            Items = descending,
            NextCursor = hasOlder && descending.Count > 0 ? descending[0].Sequence : null
        };
    }

    private async Task ValidateContextOwnershipAsync(AppendTimelineEntryRequest request, CancellationToken cancellationToken)
    {
        if (!request.ContextId.HasValue) return;

        var contextId = request.ContextId.Value;
        var contextKind = request.ContextKind!.Trim().ToLowerInvariant();
        var belongsToOrganization = contextKind switch
        {
            "property" => await context.Properties.AnyAsync(x => x.Id == contextId && x.OrganizationId == request.OrganizationId, cancellationToken),
            "unit" => await context.Units.AnyAsync(x => x.Id == contextId && x.OrganizationId == request.OrganizationId, cancellationToken),
            "listing" => await context.Listings.AnyAsync(x => x.Id == contextId && x.OrganizationId == request.OrganizationId, cancellationToken),
            "lead" => await context.Leads.AnyAsync(x => x.Id == contextId && x.OrganizationId == request.OrganizationId, cancellationToken),
            "rentalapplication" => await context.RentalApplications.AnyAsync(x => x.Id == contextId && x.OrganizationId == request.OrganizationId, cancellationToken),
            "lease" => await context.Leases.AnyAsync(x => x.Id == contextId && x.OrganizationId == request.OrganizationId, cancellationToken),
            "payment" => await context.Payments.AnyAsync(x => x.Id == contextId && x.OrganizationId == request.OrganizationId, cancellationToken),
            "maintenance" => await context.MaintenanceRequests.AnyAsync(x => x.Id == contextId && x.OrganizationId == request.OrganizationId, cancellationToken),
            _ => false
        };

        if (!belongsToOrganization)
            throw new InvalidOperationException("Event context belongs to a different organization or does not exist.");
    }

    private static void Validate(AppendTimelineEntryRequest request)
    {
        if (request.OrganizationId <= 0 || request.ConversationId <= 0) throw new ArgumentException("Organization and conversation are required.");
        if (request.OccurredAtUtc.Kind != DateTimeKind.Utc) throw new ArgumentException("OccurredAtUtc must be UTC.");
        if (string.IsNullOrWhiteSpace(request.SourceType) || request.SourceType.Length > 100) throw new ArgumentException("SourceType is invalid.");
        if (string.IsNullOrWhiteSpace(request.SourceId) || request.SourceId.Length > 200) throw new ArgumentException("SourceId is invalid.");
        if (string.IsNullOrWhiteSpace(request.Summary) || request.Summary.Length > 500) throw new ArgumentException("Summary is invalid.");
        if (string.IsNullOrWhiteSpace(request.Producer) || request.Producer.Length > 100) throw new ArgumentException("Producer is invalid.");
        if (string.IsNullOrWhiteSpace(request.EventId) || request.EventId.Length > 200) throw new ArgumentException("EventId is invalid.");
        if (!Regex.IsMatch(request.PayloadHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant)) throw new ArgumentException("PayloadHash must be lowercase SHA-256 hex.");
        if (request.MetadataVersion != 1 || request.Metadata.Keys.Any(key => !MetadataV1Keys.Contains(key)))
            throw new ArgumentException("Metadata version or key is not allowlisted.");
        var hasContext = request.ContextId.HasValue || !string.IsNullOrWhiteSpace(request.ContextKind) || !string.IsNullOrWhiteSpace(request.ContextLabel);
        if (hasContext && (!request.ContextId.HasValue || request.ContextId <= 0 || string.IsNullOrWhiteSpace(request.ContextKind) ||
                           string.IsNullOrWhiteSpace(request.ContextLabel) || request.ContextLabel.Length > 200 ||
                           !new[] { "property", "unit", "listing", "lead", "rentalApplication", "lease", "payment", "maintenance" }
                               .Contains(request.ContextKind, StringComparer.OrdinalIgnoreCase)))
            throw new ArgumentException("Event context must be a complete allowlisted exact context.");
        if (SerializeMetadata(request.Metadata).Length > 4000) throw new ArgumentException("Metadata is too large.");
    }

    internal static string SerializeMetadata(IReadOnlyDictionary<string, string> metadata) =>
        JsonSerializer.Serialize(metadata.OrderBy(x => x.Key).ToDictionary(x => x.Key, x => x.Value, StringComparer.Ordinal));
}
