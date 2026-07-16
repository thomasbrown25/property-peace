namespace brownstone_hub_api.Models
{
    public class CollectionsAgentAction
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        public long LeaseId { get; set; }
        public Lease? Lease { get; set; }
        public long? TenantId { get; set; }
        public string TenantNameSnapshot { get; set; } = string.Empty;
        public string PropertyNameSnapshot { get; set; } = string.Empty;
        public string UnitNameSnapshot { get; set; } = string.Empty;
        public string ActionType { get; set; } = string.Empty; // "sent", "flagged", "late_fee", "suppressed"
        public string? FollowUpType { get; set; }              // e.g. "CollectionsAgent_Overdue" / "CollectionsAgent_PreDue"
        public string Message { get; set; } = string.Empty;    // Human-readable description
        public string? InAppMessage { get; set; }              // Immutable copy; does not depend on the conversation message row
        public string? EmailSubject { get; set; }
        public string? EmailMessage { get; set; }
        public long? ConversationId { get; set; }              // Reference only; no FK so deleting conversation/messages doesn't erase history
        public long? MessageId { get; set; }                   // Reference only; no FK so deleting a message doesn't erase history
        public bool EmailSent { get; set; }
        public int? SuppressionDays { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsManual { get; set; } = false;            // True if force-triggered by landlord
    }
}
