namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Represents a participant in a conversation (for group chats)
    /// </summary>
    public class ConversationParticipant
    {
        public long Id { get; set; }
        
        public long ConversationId { get; set; }
        public Conversation Conversation { get; set; } = null!;
        
        public long UserId { get; set; } // Participant user ID
        public User User { get; set; } = null!;
        
        // Participant metadata
        public bool IsAdmin { get; set; } = false; // For group chat admins
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LeftAt { get; set; } // If participant left the conversation
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
    }
}

