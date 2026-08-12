namespace brownstone_hub_api.Models;

public enum MessageDeliveryChannel
{
    InApp = 1,
    Sms = 2,
    Email = 3
}

public enum MessageDeliveryStatus
{
    Pending = 1,
    Leased = 2,
    Submitted = 3,
    Delivered = 4,
    Failed = 5,
    DeadLettered = 6,
    Suppressed = 7,
    Submitting = 8
}

/// <summary>
/// Durable evidence of a request to deliver an already-saved timeline entry. Delivery lifecycle
/// changes never own or mutate the message/timeline records to which this evidence refers.
/// </summary>
public sealed class MessageDelivery
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long ConversationTimelineEntryId { get; set; }
    public ConversationTimelineEntry ConversationTimelineEntry { get; set; } = null!;
    public long? MessageId { get; set; }
    public Message? Message { get; set; }
    public MessageDeliveryChannel Channel { get; set; }
    public MessageDeliveryStatus Status { get; set; }
    public long? RecipientUserId { get; set; }
    public User? RecipientUser { get; set; }
    public string? ProtectedDestination { get; set; }
    public string? MaskedDestination { get; set; }
    public string BodySnapshot { get; set; } = string.Empty;
    public string? HtmlBodySnapshot { get; set; }
    public string? SubjectSnapshot { get; set; }
    public string? ProtectedFromAddress { get; set; }
    public string? Provider { get; set; }
    public string? ProviderMessageId { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? NextAttemptAtUtc { get; set; }
    public Guid? ProcessingLeaseId { get; set; }
    public DateTime? ProcessingLeaseUntilUtc { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorDetail { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public DateTime? DeliveredAtUtc { get; set; }
    public DateTime? FailedAtUtc { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
