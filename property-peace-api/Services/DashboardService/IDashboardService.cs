
using brownstone_hub_api.Dtos.Dashboard;

namespace brownstone_hub_api.Services.DashboardService
{
    public interface IDashboardService
    {
        Task<ServiceResponse<DashboardSummaryDto>> GetDashboardSummary(long organizationId);
    }
}