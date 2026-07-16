using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.Organizations
{
    public interface IOrganizationInviteRepository
    {
        Task<OrganizationInvite?> GetInviteByIdAsync(long inviteId);
        Task<OrganizationInvite?> GetInviteByTokenAsync(string token);
        Task<List<OrganizationInvite>> GetInvitesByOrganizationIdAsync(long organizationId);
        Task<List<OrganizationInvite>> GetPendingInvitesByEmailAsync(string email);
        Task<OrganizationInvite> CreateInviteAsync(OrganizationInvite invite);
        Task<OrganizationInvite> UpdateInviteAsync(OrganizationInvite invite);
        Task<bool> DeleteInviteAsync(long inviteId);
        Task<bool> InviteExistsAsync(string email, long organizationId);
        Task<List<OrganizationInvite>> GetExpiredInvitesAsync();
    }
}

