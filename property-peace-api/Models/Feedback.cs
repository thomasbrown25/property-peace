namespace brownstone_hub_api.Models
{
    public class Feedback
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public string Type { get; set; } = string.Empty; // feedback, bug, feature
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public bool IsResolved { get; set; } = false;
        
        // Navigation property
        public User User { get; set; } = null!;
    }
}

