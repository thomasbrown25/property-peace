using brownstone_hub_api.Dtos.OrganizationMember;

namespace brownstone_hub_api.Services.OrganizationMemberService
{
    public interface IOrganizationMemberService
    {
        Task<ServiceResponse<LoadOrganizationMemberDto>> AddMemberAsync(AddOrganizationMemberDto dto, long selectedOrganizationId, long invitedByUserId);
        Task<ServiceResponse<LoadOrganizationMemberDto>> UpdateMemberAsync(UpdateOrganizationMemberDto dto, long selectedOrganizationId, long userId);
        Task<ServiceResponse<bool>> RemoveMemberAsync(long organizationId, long memberUserId, long requestingUserId);
        Task<ServiceResponse<List<LoadOrganizationMemberDto>>> GetMembersByOrganizationIdAsync(long organizationId, long userId);
        Task<ServiceResponse<LoadOrganizationMemberDto>> GetMemberAsync(long organizationId, long memberUserId, long userId);
        Task<ServiceResponse<bool>> UserHasPermissionAsync(long userId, long organizationId, string permission);
    }
}

