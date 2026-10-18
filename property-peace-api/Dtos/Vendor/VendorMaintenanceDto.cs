namespace brownstone_hub_api.Dtos.Vendor;

public sealed record VendorMaintenanceDto(
    long Id,
    string? OrderNumber,
    string Title,
    string PropertyName,
    string? UnitName,
    string Status,
    string Priority,
    DateTime CreatedAt,
    DateTime? AssignedAt,
    DateTime? CompletedAt,
    bool IsCurrentAssignment,
    bool WasReassigned);
