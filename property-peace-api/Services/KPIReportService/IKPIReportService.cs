using brownstone_hub_api.Dtos.KPIReports;

namespace brownstone_hub_api.Services.KPIReportService
{
    public interface IKPIReportService
    {
        Task<ServiceResponse<OccupancyReportDto>> GetOccupancyReport(long organizationId, List<long>? propertyIds = null, List<long>? unitIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null);
        Task<ServiceResponse<RevenuePerUnitDto>> GetRevenuePerUnitReport(long organizationId, List<long>? propertyIds = null, List<long>? unitIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null);
        Task<ServiceResponse<UnitsPerClientDto>> GetUnitsPerClientReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null);
        Task<ServiceResponse<ClientChurnDto>> GetClientChurnReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null);
        Task<ServiceResponse<UnitsPerEmployeeDto>> GetUnitsPerEmployeeReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null);
        Task<ServiceResponse<ClosingRateDto>> GetClosingRateReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null);
        Task<ServiceResponse<MedianDOMDto>> GetMedianDOMReport(long organizationId, List<long>? propertyIds = null, List<long>? unitIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null);
        Task<ServiceResponse<MedianTTTDto>> GetMedianTTTReport(long organizationId, List<long>? propertyIds = null, List<long>? unitIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null);
        Task<ServiceResponse<NPSDto>> GetNPSClientReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null);
        Task<ServiceResponse<NPSDto>> GetNPSTenantReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null);
    }
}
