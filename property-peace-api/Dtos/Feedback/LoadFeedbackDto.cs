namespace brownstone_hub_api.Dtos.Feedback
{
    public class LoadFeedbackDto
    {
        public long Id { get; set; }
        public long UserId { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsResolved { get; set; }
    }
}

