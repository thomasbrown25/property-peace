namespace brownstone_hub_api.Dtos.Feedback
{
    public class AddFeedbackDto
    {
        public string Type { get; set; } = string.Empty; // feedback, bug, feature
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}

