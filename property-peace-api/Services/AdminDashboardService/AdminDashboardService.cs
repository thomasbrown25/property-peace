using brownstone_hub_api.Dtos.AdminDashboard;
using brownstone_hub_api.Repositories.AdminDashboard;

namespace brownstone_hub_api.Services.AdminDashboardService;

public sealed class AdminDashboardService : IAdminDashboardService
{
    public const int MinimumWindowDays = 7;
    public const int MaximumWindowDays = 90;

    private readonly IAdminDashboardRepository _repository;
    private readonly TimeProvider _timeProvider;

    public AdminDashboardService(IAdminDashboardRepository repository, TimeProvider timeProvider)
    {
        _repository = repository;
        _timeProvider = timeProvider;
    }

    public Task<AdminDashboardSummaryDto> GetSummaryAsync(
        int windowDays,
        CancellationToken cancellationToken = default)
    {
        var clampedWindow = Math.Clamp(windowDays, MinimumWindowDays, MaximumWindowDays);
        return _repository.GetSummaryAsync(clampedWindow, _timeProvider.GetUtcNow().UtcDateTime, cancellationToken);
    }
}
