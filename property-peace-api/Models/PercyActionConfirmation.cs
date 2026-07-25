namespace brownstone_hub_api.Models
{
    public class PercyActionConfirmation
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public long UserId { get; set; }
        public long ConversationId { get; set; }
        public long? RequestedByMessageId { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public string ActionPayloadJson { get; set; } = "{}";
        public string FriendlyLabel { get; set; } = string.Empty;
        public string Status { get; set; } = "pending";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public string? ResolutionMessage { get; set; }
        public byte[] Version { get; set; } = [];
        public Organization Organization { get; set; } = null!;
        public User User { get; set; } = null!;
        public PercyConversation Conversation { get; set; } = null!;
    }
}
