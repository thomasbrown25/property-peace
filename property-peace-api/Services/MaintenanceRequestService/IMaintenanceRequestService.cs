using brownstone_hub_api.Dtos.MaintenanceCategory;
using brownstone_hub_api.Dtos.MaintenanceEvent;
using brownstone_hub_api.Dtos.MaintenanceRequest;

namespace brownstone_hub_api.Services.MaintenanceRequestService
{
    public interface IMaintenanceRequestService
    {
        Task<ServiceResponse<LoadMaintenanceRequestDto>> AddMaintenanceRequest(AddMaintenanceRequestDto maintenanceRequestDto, List<IFormFile> files);
        Task<ServiceResponse<LoadMaintenanceRequestDto>> UpdateMaintenanceRequest(long maintenanceRequestId, UpdateMaintenanceRequestDto updateMaintenanceRequestDto);
        Task<ServiceResponse<LoadMaintenanceRequestDto>> GetMaintenanceRequestById(long maintenanceRequestId);
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceRequestsByPropertyId(long propertyId);
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceRequestsByUnitId(long unitId);
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetCurrentMaintenanceByPropertyId(long propertyId);
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceHistoryByPropertyId(long propertyId);
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetCurrentMaintenanceByLandlordId(long landlordId);
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceHistoryByLandlordId(long landlordId);
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetCurrentMaintenanceByOrganizationId(long organizationId);
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceHistoryByOrganizationId(long organizationId);
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetCurrentMaintenanceByTenantUserId();
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> GetMaintenanceHistoryByTenantUserId();
        Task<ServiceResponse<List<MaintenanceEventDto>>> GetMaintenanceEventsByRequestId(long maintenanceRequestId);
        Task<ServiceResponse<int>> GetPropertyOpenMaintenanceRequestsCount(long propertyId);
        Task<ServiceResponse<bool>> DeleteMaintenanceRequest(long maintenanceRequestId);
        Task<ServiceResponse<List<LoadMaintenanceCategoryDto>>> GetMaintenanceCategories();
        Task<ServiceResponse<List<LoadMaintenanceRequestDto>>> ReopenMaintenance(long requestId);
        Task<ServiceResponse<LoadMaintenanceRequestDto>> ResolveMaintenance(long requestId);
        Task<ServiceResponse<MaintenanceAnalysisResult>> AnalyzeMaintenanceRequest(string title, string description);
        Task<ServiceResponse<LoadMaintenanceRequestDto>> AssignMaintenanceRequest(long maintenanceRequestId, AssignMaintenanceRequestDto dto);
        Task<ServiceResponse<GenerateTenantMessageResultDto>> GenerateTenantMessage(long maintenanceRequestId);
        /// <summary>
        /// Creates a maintenance request with pre-classified category and priority (no AI re-classification).
        /// Used by the Maintenance Agent after it has already gathered and confirmed details with the tenant.
        /// </summary>
        Task<ServiceResponse<LoadMaintenanceRequestDto>> AddMaintenanceRequestFromAgent(AddMaintenanceRequestDto dto);
    }
}