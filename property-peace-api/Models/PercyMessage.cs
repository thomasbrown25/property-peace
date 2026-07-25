namespace brownstone_hub_api.Models
{
    public class PercyMessage
    {
        public long Id { get; set; }
        public long ConversationId { get; set; }
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? ResponseJson { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public PercyConversation Conversation { get; set; } = null!;
    }
}
