using brownstone_hub_api.Models;
using brownstone_hub_api.Services.MaintenanceTriage;

namespace brownstone_hub_api.Dtos.Maintenance;

public sealed class CreateMaintenanceRequestDto
{
    public long PropertyId { get; init; }
    public long UnitId { get; init; }
    public string? Title { get; init; }
    public string? Description { get; init; }
    public string? Location { get; init; }
    public IReadOnlyCollection<MaintenanceSignal> Signals { get; init; } = [];
    public bool HasPhotos { get; init; }
    public IReadOnlyCollection<CreateMaintenancePreferredWindowDto> PreferredWindows { get; init; } = [];
}

public sealed record CreateMaintenancePreferredWindowDto(DateTimeOffset StartsAtUtc, DateTimeOffset EndsAtUtc, string? AccessInstructions);

public sealed record ChangeMaintenanceStatusDto(EMaintenanceStatus Status, EMaintenanceStatus? ExpectedStatus = null);

public sealed record MaintenanceRequestDetailDto(
    long Id,
    long PropertyId,
    long? UnitId,
    string Title,
    string Description,
    string? Location,
    EMaintenanceStatus Status,
    MaintenanceUrgency Urgency,
    string? TriagePolicyVersion,
    string? LandlordSummary,
    IReadOnlyList<string> MissingInformation,
    bool StopTroubleshooting,
    DateTimeOffset? TriagedAtUtc,
    DateTimeOffset? AcknowledgeByUtc,
    DateTimeOffset? ActionByUtc,
    IReadOnlyList<MaintenancePreferredWindowDto> PreferredWindows,
    IReadOnlyList<MaintenanceTroubleshootingStepDto> TroubleshootingSteps,
    int ResolutionCycle,
    MaintenanceAssignmentDto? Assignment,
    IReadOnlyList<MaintenanceEstimateDto> Estimates,
    IReadOnlyList<MaintenanceWorkOrderDto> WorkOrders,
    IReadOnlyList<MaintenanceAppointmentDto> Appointments,
    IReadOnlyList<MaintenanceCompletionDto> Completions,
    IReadOnlyList<MaintenanceAttachmentDto> Attachments,
    IReadOnlyList<MaintenanceActivityEventDto> Activities,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    double AgeHours,
    MaintenanceSlaStatusDto Sla);

public sealed record MaintenanceSlaStatusDto(
    DateTimeOffset ServerEvaluatedAtUtc,
    bool IsAcknowledgeOverdue,
    bool IsActionOverdue);

public sealed record MaintenancePreferredWindowDto(long Id, DateTimeOffset StartsAtUtc, DateTimeOffset EndsAtUtc, string? AccessInstructions);

public sealed record MaintenanceTroubleshootingStepDto(
    long Id,
    string ResolutionCycleKey,
    string StepKey,
    int Sequence,
    string StepCode,
    string Instruction,
    MaintenanceTroubleshootingOutcome Outcome,
    string? TenantResponse,
    DateTimeOffset? AttemptedAtUtc);

public sealed record PercyTroubleshootingCommandDto(
    string ResolutionCycleKey,
    string StepKey,
    string StepCode,
    bool IsWorsening,
    bool HasNewEmergency,
    string? ClientInstruction = null);

public sealed record PercyTroubleshootingOutcomeCommandDto(
    MaintenanceTroubleshootingOutcome Outcome,
    string? TenantResponse);
