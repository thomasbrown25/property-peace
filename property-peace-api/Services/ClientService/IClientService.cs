
using brownstone_hub_api.Dtos.Client;

namespace brownstone_hub_api.Services.ClientService
{
    public interface IClientService
    {
        Task<ServiceResponse<List<LoadClientDto>>> GetClientsByOrganization(long organizationId);
        Task<ServiceResponse<LoadClientDto>> GetClientById(long id);
        Task<ServiceResponse<LoadClientDto>> AddOrUpdateClient(AddOrUpdateClientDto dto);
        Task<ServiceResponse<bool>> DeleteClient(long id);
        Task<ServiceResponse<bool>> LinkPropertyToClient(long propertyId, long clientId);
        Task<ServiceResponse<bool>> UnlinkPropertyFromClient(long propertyId);
        Task<ServiceResponse<bool>> ResendInvite(long clientId);
        Task<ServiceResponse<ValidateClientInviteTokenDto>> ValidateInviteToken(string token);
    }
}
