namespace brownstone_hub_api.Models;

/// <summary>Minimal, append-only, organization-scoped evidence that an activation milestone occurred.</summary>
public sealed class ActivationMilestoneOccurrence
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public string Milestone { get; set; } = string.Empty;
    public string SubjectId { get; set; } = string.Empty;
    public DateTime OccurredAtUtc { get; set; }
    public DateTime RecordedAtUtc { get; set; }
    public bool IsTimestampEstimated { get; set; }
    public long? ActorUserId { get; set; }
    public string? SourceEventType { get; set; }
    public string? SourceEventId { get; set; }
}
