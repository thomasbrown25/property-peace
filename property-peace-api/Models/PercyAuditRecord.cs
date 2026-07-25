namespace brownstone_hub_api.Models
{
    public class PercyAuditRecord
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public long UserId { get; set; }
        public long? ConversationId { get; set; }
        public long? ConfirmationId { get; set; }
        public string EventType { get; set; } = string.Empty;
        public string Outcome { get; set; } = string.Empty;
        public string Detail { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public Organization Organization { get; set; } = null!;
        public User User { get; set; } = null!;
    }
}
