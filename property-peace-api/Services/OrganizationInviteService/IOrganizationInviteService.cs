using brownstone_hub_api.Dtos.OrganizationInvite;

namespace brownstone_hub_api.Services.OrganizationInviteService
{
    public interface IOrganizationInviteService
    {
        Task<ServiceResponse<LoadOrganizationInviteDto>> CreateInviteAsync(CreateOrganizationInviteDto dto, long selectedOrganizationId, long invitedByUserId);
        Task<ServiceResponse<LoadOrganizationInviteDto>> GetInviteByTokenAsync(string token);
        Task<ServiceResponse<List<LoadOrganizationInviteDto>>> GetInvitesByOrganizationIdAsync(long organizationId, long userId);
        Task<ServiceResponse<List<LoadOrganizationInviteDto>>> GetPendingInvitesByEmailAsync(string email);
        Task<ServiceResponse<bool>> AcceptInviteAsync(AcceptOrganizationInviteDto dto, long userId);
        Task<ServiceResponse<bool>> DeleteInviteAsync(long inviteId, long userId);
        Task<ServiceResponse<LoadOrganizationInviteDto>> ResendInviteAsync(long inviteId, long userId);
    }
}

