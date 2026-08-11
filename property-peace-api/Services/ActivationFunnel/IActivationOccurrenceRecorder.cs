namespace brownstone_hub_api.Services.ActivationFunnel;

public sealed record ActivationOccurrenceRequest(
    long OrganizationId,
    string Milestone,
    string SubjectId,
    DateTimeOffset OccurredAtUtc,
    bool IsTimestampEstimated = false,
    string? SourceEventType = null,
    string? SourceEventId = null,
    long? ActorUserId = null);

public interface IActivationOccurrenceRecorder
{
    /// <returns>True when inserted; false when the same organization/milestone/subject already exists.</returns>
    Task<bool> RecordAsync(ActivationOccurrenceRequest request, CancellationToken cancellationToken = default);
}
