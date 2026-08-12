namespace brownstone_hub_api.Models
{
    public class PercyChatOperation
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public long UserId { get; set; }
        public string ClientRequestId { get; set; } = string.Empty;
        public string RequestHash { get; set; } = string.Empty;
        public string Status { get; set; } = "processing";
        public long? ConversationId { get; set; }
        public long? UserMessageId { get; set; }
        public long? AssistantMessageId { get; set; }
        public string? CompletedResponseJson { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LeaseExpiresAt { get; set; }
        public byte[] Version { get; set; } = [];
        public Organization Organization { get; set; } = null!;
        public User User { get; set; } = null!;
        public PercyConversation? Conversation { get; set; }
        public PercyMessage? UserMessage { get; set; }
        public PercyMessage? AssistantMessage { get; set; }
    }
}
