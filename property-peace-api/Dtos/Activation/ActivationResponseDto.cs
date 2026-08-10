namespace brownstone_hub_api.Dtos.Activation;

public sealed record ActivationResponseDto(
    long OrganizationId,
    string Role,
    DateTimeOffset EvaluatedAt,
    ActivationContextDto Context,
    ActivationProgressDto Progress,
    IReadOnlyList<ActivationStepDto> Steps);

public sealed record ActivationContextDto(
    long? PropertyId,
    long? UnitId,
    long? ListingId,
    long? ApplicationId,
    long? LeaseId,
    long? TenantId);

public sealed record ActivationProgressDto(int Completed, int Total);

public sealed record ActivationStepDto(
    string Key,
    string Status,
    bool Complete,
    bool Actionable,
    bool OwnerActionRequired,
    IReadOnlyDictionary<string, bool> Evidence);
