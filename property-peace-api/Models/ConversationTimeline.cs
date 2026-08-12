using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models;

public enum TimelineEntryKind
{
    Message = 1,
    System = 2,
    StatusChanged = 3,
    Payment = 4,
    Maintenance = 5,
    InAppMessage = 6,
    InboundSms = 7,
    OutboundSms = 8,
    Email = 9,
    Reminder = 10,
    Screening = 11,
    Lease = 12,
    PercyFollowUp = 13
}

public enum TimelineVisibility
{
    Participants = 1,
    StaffOnly = 2
}

public sealed class ConversationContextLink
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;
    public long? PropertyId { get; set; }
    public Property? Property { get; set; }
    public long? UnitId { get; set; }
    public Unit? Unit { get; set; }
    public long? ListingId { get; set; }
    public Listing? Listing { get; set; }
    public long? LeadId { get; set; }
    public Lead? Lead { get; set; }
    public long? RentalApplicationId { get; set; }
    public RentalApplication? RentalApplication { get; set; }
    public long? LeaseId { get; set; }
    public Lease? Lease { get; set; }
    public long? PaymentId { get; set; }
    public Payment? Payment { get; set; }
    public long? MaintenanceRequestId { get; set; }
    public MaintenanceRequest? MaintenanceRequest { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    [NotMapped]
    public int TargetCount => new long?[]
    {
        PropertyId, UnitId, ListingId, LeadId, RentalApplicationId, LeaseId, PaymentId, MaintenanceRequestId
    }.Count(id => id.HasValue);
}

public sealed class ConversationTimelineEntry
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;
    public long Sequence { get; set; }
    public TimelineEntryKind Kind { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public DateTime RecordedAtUtc { get; set; } = DateTime.UtcNow;
    public long? ActorUserId { get; set; }
    public User? ActorUser { get; set; }
    public long? MessageId { get; set; }
    public Message? Message { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public int MetadataVersion { get; set; } = 1;
    public string MetadataJson { get; set; } = "{}";
    // Immutable, smallest event-specific context (as opposed to broad conversation links).
    public string? ContextKind { get; set; }
    public long? ContextId { get; set; }
    public string? ContextLabel { get; set; }
    public TimelineVisibility Visibility { get; set; } = TimelineVisibility.Participants;
    public string Producer { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string PayloadHash { get; set; } = string.Empty;
}

public sealed class ConversationTimelineSequence
{
    public long ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;
    public long NextSequence { get; set; } = 1;
    public byte[] RowVersion { get; set; } = [];
}

public sealed class ConversationReadWatermark
{
    public long ConversationId { get; set; }
    public long UserId { get; set; }
    public long LastReadSequence { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public sealed class QuickReply
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long? OwnerUserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string? ContextKind { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public enum FollowUpTaskStatus { Open = 1, Completed = 2, Cancelled = 3 }

public sealed class ConversationFollowUpTask
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long ConversationId { get; set; }
    public long TimelineEntryId { get; set; }
    public string ContextKind { get; set; } = string.Empty;
    public long ContextId { get; set; }
    public long AssigneeUserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime DueAtUtc { get; set; }
    public FollowUpTaskStatus Status { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public long CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
