namespace brownstone_hub_api.Repositories.Organizations;

public sealed record OrganizationMemberRemovalResult(
    bool Removed,
    long? RemovedUserId,
    long? CurrentOrganizationId);
