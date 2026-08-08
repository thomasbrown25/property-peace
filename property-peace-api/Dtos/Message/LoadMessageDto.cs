namespace brownstone_hub_api.Dtos.Message
{
    public class LoadMessageDto
    {
        public long Id { get; set; }
        public long ConversationId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; }
        public string? AttachmentName { get; set; }
        
        // Sender info
        public long SenderId { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string? SenderEmail { get; set; }
        public string? SenderProfileImageUrl { get; set; }
        
        // Reply info
        public long? ReplyToMessageId { get; set; }
        public LoadMessageDto? ReplyToMessage { get; set; } // Nested reply message
        
        // Status
        public bool IsEdited { get; set; }
        public DateTime? EditedAt { get; set; }
        public bool IsDeleted { get; set; }
        public bool IsUrgent { get; set; }
        public DateTime? UrgentDetectedAt { get; set; }
        
        // Read status (for current user)
        public bool IsRead { get; set; }
        public DateTime? ReadAt { get; set; }
        
        public DateTime CreatedAt { get; set; }

        // Used by the request pipeline to suppress duplicate external side effects.
        public bool WasReplayed { get; set; }
    }
}

