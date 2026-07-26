using brownstone_hub_api.Dtos.AdminDashboard;

namespace brownstone_hub_api.Services.AdminDashboardService;

public interface IAdminDashboardService
{
    Task<AdminDashboardSummaryDto> GetSummaryAsync(int windowDays, CancellationToken cancellationToken = default);
}
