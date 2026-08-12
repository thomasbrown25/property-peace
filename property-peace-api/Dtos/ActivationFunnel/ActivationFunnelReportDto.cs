namespace brownstone_hub_api.Dtos.ActivationFunnel;

public sealed record ActivationFunnelMilestoneDto(
    string Milestone,
    int OccurrenceCount,
    int OrganizationCount,
    int EstimatedTimestampCount);

public sealed record ActivationFunnelReportDto(
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    IReadOnlyList<ActivationFunnelMilestoneDto> Milestones);
