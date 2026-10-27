using System.Text.Json;

namespace brownstone_hub_api.Models;

/// <summary>Assignment identity stored alongside a maintenance request, not inferred from its current vendor.</summary>
public static class VendorAssignmentHistory
{
    public const string EventType = "vendor.assignment.recorded";

    public static MaintenanceActivityEvent Create(MaintenanceRequest request, long actorUserId, long? vendorId, DateTime? assignedAt = null)
        => new()
        {
            MaintenanceRequestId = request.Id,
            ActorUserId = actorUserId,
            EventType = EventType,
            SubjectType = "maintenanceRequest",
            SubjectId = request.Id,
            Visibility = MaintenanceActivityVisibility.StaffOnly,
            Summary = "Maintenance assignment updated",
            MetadataJson = JsonSerializer.Serialize(new { vendorId }),
            OccurredAtUtc = assignedAt.HasValue ? new DateTimeOffset(DateTime.SpecifyKind(assignedAt.Value, DateTimeKind.Utc)) : DateTimeOffset.UtcNow
        };
}
