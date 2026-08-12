using brownstone_hub_api.Models;

namespace brownstone_hub_api.Dtos.Timeline;

public sealed class ConversationContextTarget
{
    public long? PropertyId { get; init; }
    public long? UnitId { get; init; }
    public long? ListingId { get; init; }
    public long? LeadId { get; init; }
    public long? RentalApplicationId { get; init; }
    public long? LeaseId { get; init; }
    public long? PaymentId { get; init; }
    public long? MaintenanceRequestId { get; init; }

    public int TargetCount => new long?[]
    {
        PropertyId, UnitId, ListingId, LeadId, RentalApplicationId, LeaseId, PaymentId, MaintenanceRequestId
    }.Count(id => id.HasValue);
}

public sealed class AppendTimelineEntryRequest
{
    public long OrganizationId { get; init; }
    public long ConversationId { get; init; }
    public TimelineEntryKind Kind { get; init; }
    public DateTime OccurredAtUtc { get; init; }
    public long? ActorUserId { get; init; }
    public long? MessageId { get; init; }
    public string SourceType { get; init; } = string.Empty;
    public string SourceId { get; init; } = string.Empty;
    public string Summary { get; init; } = string.Empty;
    public int MetadataVersion { get; init; } = 1;
    public IReadOnlyDictionary<string, string> Metadata { get; init; } = new Dictionary<string, string>();
    public string? ContextKind { get; init; }
    public long? ContextId { get; init; }
    public string? ContextLabel { get; init; }
    public TimelineVisibility Visibility { get; init; } = TimelineVisibility.Participants;
    public string Producer { get; init; } = string.Empty;
    public string EventId { get; init; } = string.Empty;
    public string PayloadHash { get; init; } = string.Empty;
}

public sealed class TimelinePage
{
    public IReadOnlyList<ConversationTimelineEntry> Items { get; init; } = [];
    public long? NextCursor { get; init; }
}

public sealed record TimelineContextDto(string Kind, long Id, string Label);
public sealed record DeliverySummaryDto(string Channel, string Status, string? MaskedDestination, DateTime? SubmittedAtUtc, DateTime? DeliveredAtUtc, DateTime? FailedAtUtc);
public sealed record TimelineItemDto(long Id, long ConversationId, long Sequence, string Kind, DateTime OccurredAtUtc,
    long? ActorUserId, string Summary, int MetadataVersion, IReadOnlyDictionary<string, string> Metadata,
    TimelineContextDto? Context, string Visibility, IReadOnlyList<DeliverySummaryDto> Deliveries);
public sealed record TimelineDtoPage(IReadOnlyList<TimelineItemDto> Items, long? NextCursor);

public sealed class TimelineSearchRequest
{
    public string? Query { get; init; }
    public long? OrganizationId { get; init; }
    public long? ConversationId { get; init; }
    public string? ContextKind { get; init; }
    public long? ContextId { get; init; }
    public IReadOnlyCollection<TimelineEntryKind>? Kinds { get; init; }
    public DateTime? FromUtc { get; init; }
    public DateTime? ToUtc { get; init; }
    public string? Channel { get; init; }
    public string? Status { get; init; }
    public int Skip { get; init; }
    public int Take { get; init; } = 50;
}
public sealed record TimelineSearchPage(IReadOnlyList<TimelineItemDto> Items, int Skip, int Take);
public sealed record UnreadStateDto(long ConversationId, long LastReadSequence, long LatestVisibleSequence, int UnreadCount);

public sealed record SaveQuickReplyRequest(long OrganizationId, long? OwnerUserId, string Title, string Body,
    int SortOrder, bool IsActive, string? ContextKind);
public sealed record QuickReplyDto(long Id, long OrganizationId, long? OwnerUserId, string Title, string Body,
    int SortOrder, bool IsActive, string? ContextKind);
public sealed record CreateGroupRequest(long OrganizationId, string Title, IReadOnlyCollection<long> ParticipantUserIds);
public sealed record GroupDto(long Id, long OrganizationId, string Title, IReadOnlyList<long> ParticipantUserIds);
public sealed record ParticipantDiscoveryDto(long UserId, string DisplayName, bool IsStaff);

public sealed record SaveFollowUpTaskRequest(long OrganizationId, long ConversationId, long TimelineEntryId,
    string ContextKind, long ContextId, long AssigneeUserId, string Title, DateTime DueAtUtc, string IdempotencyKey);
public sealed record FollowUpTaskDto(long Id, long OrganizationId, long ConversationId, long TimelineEntryId,
    TimelineContextDto Context, long AssigneeUserId, string Title, DateTime DueAtUtc, string Status,
    DateTime? CompletedAtUtc, byte[] RowVersion);
