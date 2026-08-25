namespace brownstone_hub_api.Dtos.RentPaymentAccess;

public sealed record RentPaymentAccessDto(
    Guid? PublicId,
    int OrganizationId,
    string Status,
    DateTime? RequestedAtUtc,
    DateTime? ReviewedAtUtc,
    string? DecisionReason);

public sealed record ReviewRentPaymentAccessRequestDto(
    string? DecisionReason,
    string? InternalNotes,
    byte[] RowVersion);

public sealed record RentPaymentAccessListItemDto(
    Guid PublicId,
    int OrganizationId,
    string OrganizationName,
    string Status,
    string RequestedBy,
    DateTime RequestedAtUtc,
    DateTime? ReviewedAtUtc,
    byte[] RowVersion);

public sealed record RentPaymentAccessAuditEventDto(
    string? PriorStatus,
    string NextStatus,
    int ActorUserId,
    DateTime OccurredAtUtc,
    string? SafeMetadataJson);

public sealed record RentPaymentAccessAdminDetailDto(
    Guid PublicId,
    int OrganizationId,
    string OrganizationName,
    string Status,
    int RequestedByUserId,
    string RequestedBy,
    DateTime RequestedAtUtc,
    int? ReviewedByUserId,
    DateTime? ReviewedAtUtc,
    string? DecisionReason,
    string? InternalNotes,
    byte[] RowVersion,
    IReadOnlyList<RentPaymentAccessAuditEventDto> AuditEvents);
