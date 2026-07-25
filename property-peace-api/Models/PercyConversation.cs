namespace brownstone_hub_api.Models
{
    public class PercyConversation
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public long UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public bool IsArchived { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ArchivedAt { get; set; }
        public Organization Organization { get; set; } = null!;
        public User User { get; set; } = null!;
        public ICollection<PercyMessage> Messages { get; set; } = [];
        public ICollection<PercyActionConfirmation> Confirmations { get; set; } = [];
    }
}
