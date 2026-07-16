

using brownstone_hub_api.Dtos.Tenant;

namespace brownstone_hub_api.Repositories.Tenants
{
    public interface ITenantRepository
    {
        Task<LoadTenantDto> AddTenant(AddTenantDto tenant);
        Task<LoadTenantDto> UpdateTenant(long id, AddTenantDto tenant);
        Task<List<LoadTenantDto>> GetTenantsByLeaseId(long leaseId);
        Task<LoadTenantDto> GetTenantById(long id);
        Task<List<LoadTenantDto>> GetAllTenantsByLandlord(long landlordId);
        Task<List<LoadTenantDto>> GetAllTenantsByOrganizationId(long organizationId);
        Task<LoadTenantDto> DeleteTenant(long id);
        Task<int> DeleteTenantsByPropertyId(long propertyId);
        Task<bool> TenantEmailExists(string email);
        Task<LoadTenantDto?> GetTenantByEmail(string email);
        Task<List<long>> GetLeasesByTenantUserId(long userId);
    }
}