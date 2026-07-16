using brownstone_hub_api.Dtos.StaffMember;

namespace brownstone_hub_api.Services.StaffMemberInviteService
{
    public interface IStaffMemberInviteService
    {
        Task<ServiceResponse<LoadStaffMemberInviteDto>> CreateInvite(AddStaffMemberInviteDto invite);
        Task<ServiceResponse<ValidateStaffMemberInviteTokenDto>> ValidateInviteToken(string token);
        Task<ServiceResponse<bool>> AcceptInviteForExistingUser(AcceptStaffMemberInviteDto dto, long userId);
        Task<ServiceResponse<bool>> AcceptInviteByEmail(AcceptStaffMemberInviteDto dto);
        Task<ServiceResponse<bool>> ResendInvite(long inviteId);
        Task<ServiceResponse<bool>> MarkInviteAsUsed(string token);
        Task<ServiceResponse<List<LoadStaffMemberInviteDto>>> GetInvitesByStaffMemberId(long staffMemberId);
        Task<ServiceResponse<List<LoadStaffMemberInviteDto>>> GetInvitesByLandlordId();
        Task<ServiceResponse<bool>> DeleteInvite(long inviteId);
    }
}
