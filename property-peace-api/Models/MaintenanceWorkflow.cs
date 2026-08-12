namespace brownstone_hub_api.Models;

public enum MaintenancePreferredWindowStatus { Active = 1, Withdrawn = 2 }
public enum MaintenanceEstimateStatus { Draft = 1, Submitted = 2, Approved = 3, Rejected = 4, Expired = 5 }
public enum MaintenanceWorkOrderStatus { Draft = 1, Issued = 2, Accepted = 3, InProgress = 4, Completed = 5, Cancelled = 6 }
public enum MaintenanceAppointmentStatus { Proposed = 1, Confirmed = 2, InProgress = 3, Completed = 4, Cancelled = 5, NoShow = 6 }
public enum MaintenanceCompletionStatus { Submitted = 1, Accepted = 2, Disputed = 3 }
public enum MaintenanceTroubleshootingOutcome { Pending = 1, Completed = 2, Skipped = 3, Failed = 4, StoppedForSafety = 5 }

public sealed class MaintenanceCommandReceipt
{
    public long Id { get; set; }
    public long ActorUserId { get; set; }
    public string Operation { get; set; } = string.Empty;
    public string IdempotencyKeyHash { get; set; } = string.Empty;
    public string RequestHash { get; set; } = string.Empty;
    public string? ResponseJson { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class MaintenanceTimelineOutbox
{
    public long Id { get; set; }
    public long MaintenanceActivityEventId { get; set; }
    public MaintenanceActivityEvent MaintenanceActivityEvent { get; set; } = null!;
    public int AttemptCount { get; set; }
    public DateTimeOffset AvailableAtUtc { get; set; }
    public DateTimeOffset? NextAttemptAtUtc { get; set; }
    public DateTimeOffset? ProcessedAtUtc { get; set; }
    public DateTimeOffset? DeadLetteredAtUtc { get; set; }
    public string? LastErrorCode { get; set; }
    public Guid? ProcessingLeaseId { get; set; }
    public DateTimeOffset? ProcessingLeaseUntilUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class MaintenancePreferredWindow
{
    public long Id { get; set; }
    public long MaintenanceRequestId { get; set; }
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
    public DateTimeOffset StartsAtUtc { get; set; }
    public DateTimeOffset EndsAtUtc { get; set; }
    public MaintenancePreferredWindowStatus Status { get; set; } = MaintenancePreferredWindowStatus.Active;
    public string? AccessInstructions { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class MaintenanceEstimate
{
    public long Id { get; set; }
    public long MaintenanceRequestId { get; set; }
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
    public long? VendorId { get; set; }
    public Vendor? Vendor { get; set; }
    public MaintenanceEstimateStatus Status { get; set; } = MaintenanceEstimateStatus.Draft;
    public int Version { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public string Scope { get; set; } = string.Empty;
    public DateTimeOffset? ValidUntilUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public long SubmittedByUserId { get; set; }
    public long? ApprovedByUserId { get; set; }
    public long? DecidedByUserId { get; set; }
    public DateTimeOffset? DecidedAtUtc { get; set; }
    public string? DecisionReason { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class MaintenanceWorkOrder
{
    public long Id { get; set; }
    public long MaintenanceRequestId { get; set; }
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
    public long? MaintenanceEstimateId { get; set; }
    public MaintenanceEstimate? Estimate { get; set; }
    public long? VendorId { get; set; }
    public Vendor? Vendor { get; set; }
    public MaintenanceWorkOrderStatus Status { get; set; } = MaintenanceWorkOrderStatus.Draft;
    public int Version { get; set; }
    public string Scope { get; set; } = string.Empty;
    public decimal? AuthorizedAmount { get; set; }
    public DateTimeOffset? IssuedAtUtc { get; set; }
    public DateTimeOffset? DueAtUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public long IssuedByUserId { get; set; }
    public long? CancelledByUserId { get; set; }
    public string? CancellationReason { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class MaintenanceAppointment
{
    public long Id { get; set; }
    public long MaintenanceRequestId { get; set; }
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
    public long? MaintenanceWorkOrderId { get; set; }
    public MaintenanceWorkOrder? WorkOrder { get; set; }
    public MaintenanceAppointmentStatus Status { get; set; } = MaintenanceAppointmentStatus.Proposed;
    public int Version { get; set; }
    public DateTimeOffset StartsAtUtc { get; set; }
    public DateTimeOffset EndsAtUtc { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public long ProposedByUserId { get; set; }
    public long? ConfirmedByUserId { get; set; }
    public long? CancelledByUserId { get; set; }
    public string? CancellationReason { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class MaintenanceCompletion
{
    public long Id { get; set; }
    public long MaintenanceRequestId { get; set; }
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
    public long? MaintenanceWorkOrderId { get; set; }
    public MaintenanceWorkOrder? WorkOrder { get; set; }
    public MaintenanceCompletionStatus Status { get; set; } = MaintenanceCompletionStatus.Submitted;
    public int Version { get; set; }
    public string ResolutionNotes { get; set; } = string.Empty;
    public string CompletionEvidenceReference { get; set; } = string.Empty;
    public decimal? FinalCost { get; set; }
    public DateTimeOffset CompletedAtUtc { get; set; }
    public long? CompletedByUserId { get; set; }
    public DateTimeOffset TenantConfirmationDueAtUtc { get; set; }
    public long? ConfirmedByUserId { get; set; }
    public long? DecidedByUserId { get; set; }
    public DateTimeOffset? DecidedAtUtc { get; set; }
    public string? DecisionReason { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class MaintenanceTroubleshootingStep
{
    public long Id { get; set; }
    public long MaintenanceRequestId { get; set; }
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
    public int Sequence { get; set; }
    public string ResolutionCycleKey { get; set; } = string.Empty;
    public string StepKey { get; set; } = string.Empty;
    public string StepCode { get; set; } = string.Empty;
    public string Instruction { get; set; } = string.Empty;
    public MaintenanceTroubleshootingOutcome Outcome { get; set; } = MaintenanceTroubleshootingOutcome.Pending;
    public string? TenantResponse { get; set; }
    public DateTimeOffset? AttemptedAtUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
