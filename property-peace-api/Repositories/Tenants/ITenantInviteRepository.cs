using brownstone_hub_api.Dtos.Tenant;

namespace brownstone_hub_api.Repositories.Tenants
{
    public interface ITenantInviteRepository
    {
        Task<LoadTenantInviteDto> CreateInvite(AddTenantInviteDto invite, long createdBy, long organizationId, string inviteToken, DateTime expiresAt);
        Task<LoadTenantInviteDto?> GetInviteByToken(string token);
        Task<LoadTenantInviteDto?> GetInviteById(long id);
        Task<LoadTenantInviteDto?> GetInviteById(long id, long organizationId);
        Task<List<LoadTenantInviteDto>> GetInvitesByTenantId(long tenantId);
        Task<List<LoadTenantInviteDto>> GetInvitesByTenantId(long tenantId, long organizationId);
        Task<List<LoadTenantInviteDto>> GetInvitesByLandlordId(long landlordId);
        Task<List<LoadTenantInviteDto>> GetInvitesByLandlordId(long landlordId, long organizationId);
        Task<LoadTenantInviteDto?> GetPendingInviteByEmail(string email);
        Task<bool> MarkInviteAsUsed(string token);
        Task<bool> DeleteInvite(long id);
    }
}

