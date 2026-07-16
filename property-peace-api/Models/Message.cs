namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Represents a message within a conversation
    /// </summary>
    public class Message
    {
        public long Id { get; set; }
        
        // Message content
        public string Content { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; } // URL to attached file/document
        public string? AttachmentName { get; set; } // Original filename
        
        // Message metadata
        public bool IsEdited { get; set; } = false;
        public DateTime? EditedAt { get; set; }
        public bool IsDeleted { get; set; } = false; // Soft delete
        public DateTime? DeletedAt { get; set; }
        public bool IsUrgent { get; set; } = false; // Flag indicating if this message contains urgent content
        public DateTime? UrgentDetectedAt { get; set; } // When urgency was detected
        
        // Relationships
        public long ConversationId { get; set; }
        public Conversation Conversation { get; set; } = null!;
        
        public long SenderId { get; set; } // UserId who sent the message
        public User Sender { get; set; } = null!;
        
        // Organization ownership (also available via Conversation, but direct link for easier queries)
        public long? OrganizationId { get; set; }
        public Organization? Organization { get; set; }
        
        // Reply/thread support
        public long? ReplyToMessageId { get; set; } // If this is a reply to another message
        public Message? ReplyToMessage { get; set; }
        
        // Read receipts
        public ICollection<MessageRead> ReadReceipts { get; set; } = [];
        
        // Audit fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}

