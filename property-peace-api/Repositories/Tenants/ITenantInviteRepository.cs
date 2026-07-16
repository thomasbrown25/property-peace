using brownstone_hub_api.Dtos.Tenant;

namespace brownstone_hub_api.Repositories.Tenants
{
    public interface ITenantInviteRepository
    {
        Task<LoadTenantInviteDto> CreateInvite(AddTenantInviteDto invite, long createdBy, string inviteToken, DateTime expiresAt);
        Task<LoadTenantInviteDto?> GetInviteByToken(string token);
        Task<LoadTenantInviteDto?> GetInviteById(long id);
        Task<List<LoadTenantInviteDto>> GetInvitesByTenantId(long tenantId);
        Task<List<LoadTenantInviteDto>> GetInvitesByLandlordId(long landlordId);
        Task<LoadTenantInviteDto?> GetPendingInviteByEmail(string email);
        Task<bool> MarkInviteAsUsed(string token);
        Task<bool> DeleteInvite(long id);
    }
}

