using brownstone_hub_api.Dtos.MaintenanceCategory;
using brownstone_hub_api.Dtos.MaintenanceEvent;
using brownstone_hub_api.Dtos.MaintenanceRequest;

namespace brownstone_hub_api.Repositories.MaintenanceRequests
{
    public interface IMaintenanceRequestRepository
    {
        Task<LoadMaintenanceRequestDto> AddMaintenanceRequest(AddMaintenanceRequestDto maintenanceRequestDto);
        Task<LoadMaintenanceRequestDto?> GetMaintenanceRequestById(long maintenanceRequestId);
        Task<List<LoadMaintenanceRequestDto>> GetMaintenanceRequestsByPropertyId(long propertyId);
        Task<List<LoadMaintenanceRequestDto>> GetMaintenanceRequestsByUnitId(long unitId);
        Task<List<LoadMaintenanceRequestDto>> GetCurrentMaintenanceByPropertyId(long propertyId);
        Task<List<LoadMaintenanceRequestDto>> GetMaintenanceHistoryByPropertyId(long propertyId);
        Task<List<LoadMaintenanceRequestDto>> GetCurrentMaintenanceByLandlordId(long landlordId);
        Task<List<LoadMaintenanceRequestDto>> GetMaintenanceHistoryByLandlordId(long landlordId);
        Task<List<LoadMaintenanceRequestDto>> GetCurrentMaintenanceByOrganizationId(long organizationId);
        Task<List<LoadMaintenanceRequestDto>> GetMaintenanceHistoryByOrganizationId(long organizationId);
        Task<List<LoadMaintenanceRequestDto>> GetCurrentMaintenanceByTenantUserId(long tenantUserId);
        Task<List<LoadMaintenanceRequestDto>> GetMaintenanceHistoryByTenantUserId(long tenantUserId);
        Task<List<MaintenanceEventDto>> GetMaintenanceEventsByRequestId(long maintenanceRequestId);
        Task<int> GetPropertyOpenMaintenanceRequestsCount(long propertyId);
        Task<bool> DeleteMaintenanceRequest(long maintenanceRequestId);
        Task<int> DeleteMaintenanceRequestsByPropertyId(long propertyId);
        Task<LoadMaintenanceRequestDto?> UpdateMaintenanceRequest(UpdateMaintenanceRequestDto request);
        Task<List<LoadMaintenanceCategoryDto>> GetMaintenanceCategories();
        Task<List<LoadMaintenanceRequestDto>> ReopenMaintenance(long requestId);
        Task<LoadMaintenanceRequestDto> ResolveMaintenance(long requestId);
        Task<LoadMaintenanceRequestDto?> AssignMaintenanceRequest(long maintenanceRequestId, AssignMaintenanceRequestDto dto, long assignedByUserId);
    }
}