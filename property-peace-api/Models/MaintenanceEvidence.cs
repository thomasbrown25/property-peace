namespace brownstone_hub_api.Models;

public enum MaintenanceActivityVisibility { Participants = 1, StaffOnly = 2 }
public enum MaintenanceAttachmentPurpose { Intake = 1, Completion = 2, Reopen = 3 }
public enum MaintenanceAttachmentMediaType { Photo = 1, Video = 2 }
public enum MaintenanceAttachmentLifecycleState { PendingUpload = 1, Active = 2, PendingDeletion = 3 }

/// <summary>Actor-aware, append-only audit evidence for maintenance workflow commands.</summary>
public sealed class MaintenanceActivityEvent
{
    public long Id { get; set; }
    public long MaintenanceRequestId { get; set; }
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
    public long ActorUserId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string SubjectType { get; set; } = "maintenanceRequest";
    public long SubjectId { get; set; }
    public MaintenanceActivityVisibility Visibility { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string MetadataJson { get; set; } = "{}";
    public DateTimeOffset OccurredAtUtc { get; set; }
}

/// <summary>Request-scoped evidence metadata. BlobName is private storage identity, never a raw URL.</summary>
public sealed class MaintenanceAttachment
{
    public long Id { get; set; }
    public long MaintenanceRequestId { get; set; }
    public MaintenanceRequest MaintenanceRequest { get; set; } = null!;
    public MaintenanceAttachmentPurpose Purpose { get; set; }
    public int ResolutionCycle { get; set; }
    public MaintenanceAttachmentMediaType MediaType { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string BlobName { get; set; } = string.Empty;
    /// <summary>Temporary private blob used until the SQL transaction commits.</summary>
    public string? StagingBlobName { get; set; }
    public long UploadedByUserId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    /// <summary>Durable SQL side of the non-atomic blob/relational lifecycle.</summary>
    public MaintenanceAttachmentLifecycleState LifecycleState { get; set; } = MaintenanceAttachmentLifecycleState.PendingUpload;
    public Guid? LifecycleLeaseId { get; set; }
    public DateTimeOffset? LifecycleLeaseUntilUtc { get; set; }
}
