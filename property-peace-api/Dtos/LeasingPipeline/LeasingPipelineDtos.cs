using System.Text.Json;
using System.Text.Json.Serialization;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.LeasingPipeline;

public static class LeasingPipelineJson
{
    public static JsonSerializerOptions Options { get; } = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };
}

public sealed record LeasingPipelineDto(
    long PropertyId,
    long UnitId,
    LeasingLifecycleStage CurrentStage,
    IReadOnlyList<LifecycleStageDescriptorDto> Stages,
    LifecycleBlockerDto? Blocker,
    LifecycleActionDto? PrimaryAction,
    LifecycleReferencesDto References,
    IReadOnlyList<LifecycleRecordDto> RelevantRecords,
    string Revision,
    DateTime EvaluatedAt);

public sealed record LifecycleStageDescriptorDto(LeasingLifecycleStage Stage, int Order, bool IsCurrent, bool IsComplete);
public sealed record LifecycleBlockerDto(string Code, string Message);
public sealed record LifecycleActionDto(string Code, IReadOnlyDictionary<string, long> Data);
public sealed record LifecycleReferencesDto(long? ListingId, long? ApplicationId, long? LeaseId, long? InviteId, long? EventId);
public sealed record LifecycleRecordDto(
    string Type,
    long Id,
    string Status,
    DateTime? CreatedAt,
    DateTime? UpdatedAt,
    DateTime? SubmittedAt,
    DateTime? ScheduledAt,
    DateTime? SentAt,
    DateTime? CompletedAt,
    DateTime? ExpiresAt,
    DateTime? OccurredAt,
    DateTime? EffectiveAt);

public sealed record ShowingTransitionRequest(UnitLifecycleEventType EventType, DateTime? ScheduledAtUtc, string? Reason);
