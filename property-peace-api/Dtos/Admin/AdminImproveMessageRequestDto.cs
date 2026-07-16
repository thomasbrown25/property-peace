namespace brownstone_hub_api.Dtos.Admin;

/// <summary>
/// Request for AI to improve an announcement/warning message (admin broadcast).
/// </summary>
public class AdminImproveMessageRequestDto
{
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
}
