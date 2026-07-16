using brownstone_hub_api.Dtos.LandlordInvite;

namespace brownstone_hub_api.Services.LandlordInviteService
{
    public interface ILandlordInviteService
    {
        Task<ServiceResponse<LoadLandlordInviteDto>> CreateInvite(AddLandlordInviteDto invite);
        Task<ServiceResponse<ValidateLandlordInviteTokenDto>> ValidateInviteToken(string token);
        Task<ServiceResponse<bool>> MarkInviteAsUsed(string token);
        Task<ServiceResponse<List<LoadLandlordInviteDto>>> GetInvitesByAdmin();
    }
}
