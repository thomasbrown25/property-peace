using brownstone_hub_api.Dtos.LandlordInvite;

namespace brownstone_hub_api.Repositories.LandlordInvites
{
    public interface ILandlordInviteRepository
    {
        Task<LoadLandlordInviteDto> CreateInvite(AddLandlordInviteDto invite, long createdBy, string inviteToken, DateTime expiresAt);
        Task<LoadLandlordInviteDto?> GetInviteByToken(string token);
        Task<LoadLandlordInviteDto?> GetInviteById(long id);
        Task<bool> MarkInviteAsUsed(string token);
        Task<List<LoadLandlordInviteDto>> GetInvitesByCreatedBy(long createdBy);
    }
}
