namespace brownstone_hub_api.Dtos.SupportRequest
{
    public class SubmitSupportRequestDto
    {
        public string Type { get; set; } = string.Empty; // "tech-support" or "feedback"
        public string Subject { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}

