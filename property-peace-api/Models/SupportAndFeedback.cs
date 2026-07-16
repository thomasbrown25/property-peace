using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models
{
    public class SupportAndFeedback
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public ESupportAndFeedbackType Type { get; set; }
        public string SubType { get; set; } = string.Empty; // For feedback: "feedback", "bug", "feature"
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public bool IsResolved { get; set; } = false;
        public bool IsFavorite { get; set; } = false;
        
        // Navigation property
        public User User { get; set; } = null!;
    }
}

