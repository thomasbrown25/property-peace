namespace brownstone_hub_api.Dtos.Message
{
    public class AddMessageDto
    {
        public long ConversationId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; }
        public string? AttachmentName { get; set; }
        public long? ReplyToMessageId { get; set; } // If replying to another message
    }
}

