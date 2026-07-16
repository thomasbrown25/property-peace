namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Tracks read receipts for messages
    /// </summary>
    public class MessageRead
    {
        public long Id { get; set; }
        
        public long MessageId { get; set; }
        public Message Message { get; set; } = null!;
        
        public long UserId { get; set; } // User who read the message
        public User User { get; set; } = null!;
        
        public DateTime ReadAt { get; set; } = DateTime.UtcNow;
    }
}

