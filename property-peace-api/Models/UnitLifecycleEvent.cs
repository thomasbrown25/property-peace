using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Models;

/// <summary>Narrow append-only operational evidence and audit for canonical unit lifecycle transitions.</summary>
public sealed class UnitLifecycleEvent
{
    public long Id { get; set; }
    public long OrganizationId { get; set; }
    public long PropertyId { get; set; }
    public long UnitId { get; set; }
    public long ActorUserId { get; set; }
    public LeasingLifecycleStage PreviousStage { get; set; }
    public LeasingLifecycleStage ResultingStage { get; set; }
    public UnitLifecycleEventType EventType { get; set; }
    public DateTime? ScheduledAtUtc { get; set; }
    [MaxLength(50)] public string? Reason { get; set; }
    [MaxLength(64)] public string RequestHash { get; set; } = string.Empty;
    [MaxLength(64)] public string PreviousRevision { get; set; } = string.Empty;
    [MaxLength(200)] public string CorrelationTrace { get; set; } = string.Empty;
    [MaxLength(64)] public string IdempotencyKeyHash { get; set; } = string.Empty;
    [MaxLength(4000)] public string ResultSnapshotJson { get; set; } = string.Empty;
    public DateTime OccurredAtUtc { get; set; }
}
