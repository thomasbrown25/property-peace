namespace brownstone_hub_api.Models;

public sealed class RentPaymentAccessAuditEvent
{
    public int Id { get; set; }
    public int RentPaymentAccessRequestId { get; set; }
    public int OrganizationId { get; set; }
    public RentPaymentAccessStatus? PriorStatus { get; set; }
    public RentPaymentAccessStatus NextStatus { get; set; }
    public int ActorUserId { get; set; }
    public DateTime OccurredAtUtc { get; set; }

    // This is limited to user-safe transition metadata; it must never contain secrets,
    // financial account details, card details, or raw request bodies.
    public string? SafeMetadataJson { get; set; }

    public RentPaymentAccessRequest RentPaymentAccessRequest { get; set; } = null!;
}
