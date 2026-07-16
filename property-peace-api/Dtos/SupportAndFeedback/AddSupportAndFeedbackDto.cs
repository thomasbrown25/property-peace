using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.SupportAndFeedback
{
    public class AddSupportAndFeedbackDto
    {
        public ESupportAndFeedbackType Type { get; set; }
        public string SubType { get; set; } = string.Empty; // For feedback: "feedback", "bug", "feature"
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}

