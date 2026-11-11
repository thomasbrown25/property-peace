namespace brownstone_hub_api.Models;

/// <summary>Append-only, organization-scoped mutation history. Contains no entity payloads.</summary>
public sealed class ActivityEvent
{
    public long Id { get; set; }
    public string ActivityType { get; set; } = string.Empty;
    public string Operation { get; set; } = string.Empty;
    public long RelatedId { get; set; }
    public long OrganizationId { get; set; }
    public long? PropertyId { get; set; }
    public long? LeaseId { get; set; }
    public long? PerformedByUserId { get; set; }
    public string? PerformedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
