using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.SupportAndFeedback
{
    public class LoadSupportAndFeedbackDto
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public ESupportAndFeedbackType Type { get; set; }
        public string SubType { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsResolved { get; set; }
        public bool IsFavorite { get; set; }
    }
}

