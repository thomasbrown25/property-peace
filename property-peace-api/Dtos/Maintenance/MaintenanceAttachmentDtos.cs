using brownstone_hub_api.Models;

namespace brownstone_hub_api.Dtos.Maintenance;

public sealed record MaintenanceAttachmentDto(long Id, long MaintenanceRequestId, MaintenanceAttachmentPurpose Purpose,
    int ResolutionCycle, MaintenanceAttachmentMediaType MediaType, string FileName, string ContentType,
    long SizeBytes, long UploadedByUserId, DateTimeOffset CreatedAtUtc);
