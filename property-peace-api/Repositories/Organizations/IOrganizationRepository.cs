using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.Organizations
{
    public interface IOrganizationRepository
    {
        Task<Organization?> GetOrganizationByIdAsync(long organizationId);
        Task<Organization?> GetOrganizationByIdWithMembersAsync(long organizationId);
        Task<List<Organization>> GetOrganizationsByUserIdAsync(long userId);
        Task<Organization> CreateOrganizationAsync(Organization organization);
        Task<Organization> UpdateOrganizationAsync(Organization organization);
        Task<bool> DeleteOrganizationAsync(long organizationId);
        Task<Organization?> GetOrganizationBySubscriptionIdAsync(long subscriptionId);
        Task<bool> OrganizationExistsAsync(long organizationId);
        Task<Organization?> GetCurrentUserOrganizationAsync(long userId);
        Task<bool> OrganizationNameExistsAsync(string organizationName, long? excludeOrganizationId = null);
        Task<bool> OrganizationNameExistsForOwnerAsync(string organizationName, long ownerId, long? excludeOrganizationId = null);
    }
}

