
using brownstone_hub_api.Dtos.MaintenanceRequest;

namespace brownstone_hub_api.Dtos.Dashboard
{
    public sealed record DashboardSummaryDto(
    DashboardCounts Counts,
    DashboardMoney Money,
    DashboardFlags Flags,
    DashboardMaintenanceRequests MaintenanceRequests,
    DateTime GeneratedAtUtc);

    public sealed record DashboardCounts(
    int TotalProperties,
    int TotalUnits,
    int OccupiedUnits,
    int VacantUnits);

    public sealed record DashboardMoney(
        decimal MonthlyExpectedIncome,
        decimal MonthlyCollectedIncome,
        string Currency,
        string Month); // "YYYY-MM"

    public sealed record DashboardFlags(bool IsSingleUnitPortfolio);

    public sealed record DashboardMaintenanceRequests(List<LoadMaintenanceRequestDto> MaintenanceRequests);
}