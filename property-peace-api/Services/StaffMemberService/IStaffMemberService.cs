using brownstone_hub_api.Dtos.StaffMember;

namespace brownstone_hub_api.Services.StaffMemberService
{
    public interface IStaffMemberService
    {
        Task<ServiceResponse<LoadStaffMemberDto>> AddStaffMember(AddStaffMemberDto dto);
        Task<ServiceResponse<LoadStaffMemberDto>> UpdateStaffMember(long id, UpdateStaffMemberDto dto);
        Task<ServiceResponse<bool>> DeleteStaffMember(long id);
        Task<ServiceResponse<LoadStaffMemberDto>> GetStaffMemberById(long id);
        Task<ServiceResponse<List<LoadStaffMemberDto>>> GetStaffMembers();
        Task<ServiceResponse<LoadStaffMemberDto>> GetStaffMemberByUserId(long userId);
    }
}
