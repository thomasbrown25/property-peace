namespace brownstone_hub_api.Models
{
    public class ActionSuppression
    {
        public long Id { get; set; }
        public string ActionType { get; set; } = string.Empty; // e.g., "sendAIFollowUp_OverdueRent"
        public long EntityId { get; set; } // LeaseId, TenantId, etc.
        public long OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        public DateTime? SuppressedUntil { get; set; } // Null means permanently suppressed
        public DateTime SuppressedAt { get; set; } = DateTime.UtcNow;
        public long CreatedBy { get; set; }
        public User? CreatedByUser { get; set; }
        public string? Reason { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
