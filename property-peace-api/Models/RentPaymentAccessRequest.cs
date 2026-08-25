namespace brownstone_hub_api.Models;

public enum RentPaymentAccessStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Suspended = 4
}

public sealed class RentPaymentAccessRequest
{
    public int Id { get; set; }
    public Guid PublicId { get; set; } = Guid.NewGuid();
    public int OrganizationId { get; set; }
    public RentPaymentAccessStatus Status { get; set; }
    public int RequestedByUserId { get; set; }
    public DateTime RequestedAtUtc { get; set; }
    public int? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string? DecisionReason { get; set; }
    public string? InternalNotes { get; set; }
    public DateTime StatusChangedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public ICollection<RentPaymentAccessAuditEvent> AuditEvents { get; set; } = [];
}
