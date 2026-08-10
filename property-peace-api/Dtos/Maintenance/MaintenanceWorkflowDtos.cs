using brownstone_hub_api.Models;

namespace brownstone_hub_api.Dtos.Maintenance;

public sealed record AssignMaintenanceCommandDto(EAssignedToType AssignedToType, long? AssignedToUserId, long? VendorId, bool EstimateRequired);
public sealed record MaintenanceAssignmentDto(EAssignedToType AssignedToType, long? AssignedToUserId, long? VendorId, bool EstimateRequired, long? AssignedByUserId, DateTimeOffset? AssignedAtUtc);

public sealed record SubmitMaintenanceEstimateDto(decimal Amount, string Currency, string Scope, DateTimeOffset? ValidUntilUtc);
public sealed record EstimateVersionCommandDto(int ExpectedVersion);
public sealed record RejectEstimateCommandDto(int ExpectedVersion, string Reason);
public sealed record MaintenanceEstimateDto(long Id, int Version, MaintenanceEstimateStatus Status, decimal Amount, string Currency, string Scope, DateTimeOffset? ValidUntilUtc, long SubmittedByUserId, long? ApprovedByUserId, string? DecisionReason);

public sealed record IssueMaintenanceWorkOrderDto(long? EstimateId, string Scope, decimal? AuthorizedAmount, DateTimeOffset? DueAtUtc);
public sealed record CancelMaintenanceWorkOrderDto(int ExpectedVersion, string Reason);
public sealed record MaintenanceWorkOrderDto(long Id, int Version, MaintenanceWorkOrderStatus Status, long? EstimateId, string Scope, decimal? AuthorizedAmount, DateTimeOffset? DueAtUtc, long IssuedByUserId, string? CancellationReason);

public sealed record ProposeMaintenanceAppointmentDto(long WorkOrderId, DateTimeOffset StartsAtUtc, DateTimeOffset EndsAtUtc, string? Notes);
public sealed record WorkflowVersionCommandDto(int ExpectedVersion);
public sealed record CancelMaintenanceAppointmentDto(int ExpectedVersion, string Reason);
public sealed record MaintenanceAppointmentDto(long Id, int Version, MaintenanceAppointmentStatus Status, long WorkOrderId, DateTimeOffset StartsAtUtc, DateTimeOffset EndsAtUtc, string? Notes, long ProposedByUserId, long? ConfirmedByUserId, string? CancellationReason);

public sealed record SubmitMaintenanceCompletionDto(long WorkOrderId, string ResolutionNotes, string? CompletionEvidenceReference, decimal? FinalCost);
public sealed record CompletionDecisionCommandDto(int ExpectedVersion);
public sealed record CompletionReasonCommandDto(int ExpectedVersion, string Reason);
public sealed record MaintenanceCompletionDto(long Id, int Version, MaintenanceCompletionStatus Status, long WorkOrderId, string ResolutionNotes, string CompletionEvidenceReference, decimal? FinalCost, long? CompletedByUserId, DateTimeOffset TenantConfirmationDueAtUtc, long? ConfirmedByUserId, string? DecisionReason);

public sealed record MaintenanceCostProjectionDto(decimal? ApprovedEstimate, decimal ActualTotal, decimal? Variance);
public sealed record MaintenanceActivityEventDto(long Id, string EventType, string SubjectType, long SubjectId,
    MaintenanceActivityVisibility Visibility, string Summary, DateTimeOffset OccurredAtUtc);
