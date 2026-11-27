namespace brownstone_hub_api.Dtos.Admin;

/// <summary>
/// Request to send a broadcast email to all or selected users (admin only).
/// </summary>
public class AdminBroadcastEmailRequestDto
{
    /// <summary>Email subject line.</summary>
    public string Subject { get; set; } = string.Empty;

    /// <summary>Plain text or HTML body. If HTML, it will be sent as HTML with a plain-text fallback.</summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>Marketing broadcasts honor unsubscribes. Use false only for necessary service notices.</summary>
    public bool IsMarketing { get; set; } = true;

    /// <summary>Optional. If null or empty, email is sent to all non-deleted users with an email. Otherwise only to these user IDs.</summary>
    public List<long>? UserIds { get; set; }
}
