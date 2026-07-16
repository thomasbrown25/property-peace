using brownstone_hub_api.Dtos.StaffMember;

namespace brownstone_hub_api.Repositories.StaffMembers
{
    public interface IStaffMemberRepository
    {
        Task<LoadStaffMemberDto> AddStaffMember(AddStaffMemberDto dto);
        Task<LoadStaffMemberDto?> GetStaffMemberById(long id);
        Task<LoadStaffMemberDto?> GetStaffMemberByUserId(long userId, long organizationId);
        Task<LoadStaffMemberDto?> UpdateStaffMember(UpdateStaffMemberDto dto);
        Task<bool> DeleteStaffMember(long id);
        Task<List<LoadStaffMemberDto>> GetStaffMembersByOrganizationId(long organizationId);
        Task<bool> IsUserStaffMember(long userId, long organizationId);
    }
}
