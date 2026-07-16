namespace brownstone_hub_api.Dtos.Announcement
{
    public class FormatMessageResponseDto
    {
        public string FormattedMessage { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty; // Generated behind the scenes, not returned to frontend
    }
}
