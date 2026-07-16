

using brownstone_hub_api.Dtos.Tenant;

namespace brownstone_hub_api.Services.TenantService
{
    public interface ITenantService
    {
        Task<ServiceResponse<LoadTenantDto>> AddOrUpdateTenant(AddTenantDto tenant);
        Task<ServiceResponse<List<LoadTenantDto>>> GetTenantsByLeaseId(long leaseId);
        Task<ServiceResponse<LoadTenantDto>> GetTenantById(long id);
        Task<ServiceResponse<List<LoadTenantDto>>> GetAllTenantsByLandlord(long landlordId);
        Task<ServiceResponse<List<LoadTenantDto>>> GetAllTenantsByOrganizationId(long organizationId);
        Task<ServiceResponse<LoadTenantDto>> DeleteTenant(long id);
        Task<ServiceResponse<bool>> CheckEmailExists(string email);
        Task<ServiceResponse<LoadTenantDto>> GetTenantByEmail(string email);
    }
}