using brownstone_hub_api.Dtos.AdminDashboard;

namespace brownstone_hub_api.Repositories.AdminDashboard;

public interface IAdminDashboardRepository
{
    Task<AdminDashboardSummaryDto> GetSummaryAsync(int windowDays, DateTime generatedAtUtc, CancellationToken cancellationToken = default);
}
