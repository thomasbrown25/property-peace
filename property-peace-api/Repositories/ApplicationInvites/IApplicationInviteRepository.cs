using brownstone_hub_api.Dtos.ApplicationInvite;

namespace brownstone_hub_api.Repositories.ApplicationInvites
{
    public interface IApplicationInviteRepository
    {
        Task<LoadApplicationInviteDto> CreateInvite(AddApplicationInviteDto invite, long createdBy, string inviteToken, DateTime expiresAt, long? organizationId = null, long? applicationId = null);
        Task<LoadApplicationInviteDto?> GetInviteByToken(string token);
        Task<LoadApplicationInviteDto?> GetInviteById(long id);
        Task<LoadApplicationInviteDto?> GetInviteByApplicationId(long applicationId);
        Task<List<LoadApplicationInviteDto>> GetInvitesByPropertyId(long propertyId, long? organizationId = null);
        Task<List<LoadApplicationInviteDto>> GetInvitesByLandlordId(long landlordId, long? organizationId = null);
        Task<bool> MarkInviteAsUsed(string token, long applicationId);
        Task<bool> LinkInviteToApplication(long inviteId, long applicationId);
        Task<bool> DeleteInvite(long id);
        Task<int> DeleteInvitesByPropertyId(long propertyId);
        Task<int> DeleteInvitesByApplicationIds(List<long> applicationIds);
    }
}

