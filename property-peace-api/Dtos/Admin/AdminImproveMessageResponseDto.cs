namespace brownstone_hub_api.Dtos.Admin;

/// <summary>
/// AI-improved subject and body for broadcast message.
/// </summary>
public class AdminImproveMessageResponseDto
{
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
}
