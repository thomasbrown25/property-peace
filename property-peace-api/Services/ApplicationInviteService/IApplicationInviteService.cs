using brownstone_hub_api.Dtos.ApplicationInvite;
using brownstone_hub_api.Dtos.Application;

namespace brownstone_hub_api.Services.ApplicationInviteService
{
    public interface IApplicationInviteService
    {
        Task<ServiceResponse<LoadApplicationInviteDto>> CreateInvite(AddApplicationInviteDto invite);
        Task<ServiceResponse<ValidateApplicationInviteTokenDto>> ValidateInviteToken(string token);
        Task<ServiceResponse<List<LoadApplicationInviteDto>>> GetInvitesByPropertyId(long propertyId);
        Task<ServiceResponse<List<LoadApplicationInviteDto>>> GetInvitesByLandlordId();
        Task<ServiceResponse<bool>> DeleteInvite(long inviteId);
        Task<ServiceResponse<bool>> ResendInvite(long inviteId);
        Task<ServiceResponse<bool>> ResendInviteByApplicationId(long applicationId);
        Task<ServiceResponse<bool>> MarkInviteAsUsed(string token, long applicationId);
        Task<ServiceResponse<LoadRentalApplicationDto>> SubmitApplicationWithToken(string token, AddRentalApplicationDto application);
    }
}

