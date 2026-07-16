
using brownstone_hub_api.Dtos.Dashboard;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Services.DashboardService
{
    public class DashboardService(IPropertyRepository propertyRepository, ILeaseRepository leaseRepository, IMaintenanceRequestRepository maintenanceRequestRepository, ILogger<DashboardService> logger) : IDashboardService
    {
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IMaintenanceRequestRepository _maintenanceRequestRepository = maintenanceRequestRepository;
        private readonly ILogger<DashboardService> _logger = logger;

        public async Task<ServiceResponse<DashboardSummaryDto>> GetDashboardSummary(long organizationId)
        {
            try
            {
                var (totalProperties, totalUnits, occupiedUnits) = await _propertyRepository.GetDashboardCountsAsync(organizationId);
                var vacantUnits = totalUnits - occupiedUnits;
                var sSingleUnitPortfolio = await _propertyRepository.IsSingleUnitPortfolio(organizationId);
                var leases = await _leaseRepository.GetLeasesForRentCalculationAsync(organizationId);
                var monthlyExpectedIncome = 0m;
                var monthlyCollectedIncome = 0m;
                var start = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
                var end = start.AddMonths(1);

                if (leases != null)
                {
                    monthlyExpectedIncome = RentCalculator.TotalExpected(leases, start, end);
                }

                var maintenanceRequests = await _maintenanceRequestRepository.GetCurrentMaintenanceByOrganizationId(organizationId);


                //var monthlyCollectedIncome = properties?.Sum(p => p.CollectedIncome) ?? 0m;


                var summary = new DashboardSummaryDto(
                    new DashboardCounts(totalProperties, totalUnits, occupiedUnits, vacantUnits),
                    new DashboardMoney(monthlyExpectedIncome, monthlyCollectedIncome, "USD", $"{DateTime.UtcNow:MM-yyyy}"),
                    new DashboardFlags(sSingleUnitPortfolio),
                    new DashboardMaintenanceRequests(maintenanceRequests),
                    DateTime.UtcNow
                );

                return new ServiceResponse<DashboardSummaryDto>
                {
                    Data = summary,
                    Message = "Dashboard summary retrieved successfully."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving dashboard summary for organization {OrganizationId}", organizationId);
                return ServiceResponse<DashboardSummaryDto>.CreateError("Error retrieving dashboard summary", ex.Message);
            }
        }
    }
}