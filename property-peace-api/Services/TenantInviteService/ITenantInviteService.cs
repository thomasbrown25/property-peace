using brownstone_hub_api.Dtos.Tenant;

namespace brownstone_hub_api.Services.TenantInviteService
{
    public interface ITenantInviteService
    {
        Task<ServiceResponse<LoadTenantInviteDto>> CreateInvite(AddTenantInviteDto invite, long userId, long organizationId);
        Task<ServiceResponse<ValidateInviteTokenDto>> ValidateInviteToken(string token);
        Task<ServiceResponse<List<LoadTenantInviteDto>>> GetInvitesByTenantId(long tenantId, long userId, long organizationId);
        Task<ServiceResponse<List<LoadTenantInviteDto>>> GetInvitesByLandlordId(long userId, long organizationId);
        Task<ServiceResponse<bool>> DeleteInvite(long inviteId, long userId, long organizationId);
        Task<ServiceResponse<bool>> ResendInvite(long inviteId, long userId, long organizationId);
        Task<ServiceResponse<bool>> MarkInviteAsUsed(string token);
        Task<ServiceResponse<bool>> AcceptInviteForExistingUser(AcceptTenantInviteDto dto, long userId);
        Task<ServiceResponse<bool>> AcceptInviteByEmail(AcceptTenantInviteDto dto);
        Task<ServiceResponse<LoadTenantInviteDto?>> GetPendingInviteForCurrentUser();
    }
}

