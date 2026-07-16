
using brownstone_hub_api.Dtos.Client;

namespace brownstone_hub_api.Repositories.Clients
{
    public interface IClientRepository
    {
        Task<List<LoadClientDto>> GetClientsByOrganizationId(long organizationId);
        Task<LoadClientDto?> GetClientById(long id);
        Task<LoadClientDto?> GetClientByEmail(string email, long organizationId);
        Task<LoadClientDto> AddClient(AddOrUpdateClientDto client);
        Task<LoadClientDto> UpdateClient(long id, AddOrUpdateClientDto client);
        Task<bool> DeleteClient(long id);
        Task<List<long>> GetPropertiesByClientId(long clientId);
    }
}
