namespace brownstone_hub_api.Dtos.Admin;

/// <summary>
/// Minimal lease info for admin dropdowns (e.g. rent reminder job).
/// </summary>
public class AdminLeaseOptionDto
{
    public long Id { get; set; }
    public string Label { get; set; } = string.Empty;
}
