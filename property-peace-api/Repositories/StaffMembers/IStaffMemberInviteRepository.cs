using brownstone_hub_api.Dtos.StaffMember;

namespace brownstone_hub_api.Repositories.StaffMembers
{
    public interface IStaffMemberInviteRepository
    {
        Task<LoadStaffMemberInviteDto> CreateInvite(AddStaffMemberInviteDto invite, long createdBy, string inviteToken, DateTime expiresAt);
        Task<LoadStaffMemberInviteDto?> GetInviteByToken(string token);
        Task<LoadStaffMemberInviteDto?> GetInviteById(long id);
        Task<List<LoadStaffMemberInviteDto>> GetInvitesByStaffMemberId(long staffMemberId);
        Task<List<LoadStaffMemberInviteDto>> GetInvitesByLandlordId(long landlordId);
        Task<bool> MarkInviteAsUsed(string token);
        Task<bool> DeleteInvite(long id);
    }
}
