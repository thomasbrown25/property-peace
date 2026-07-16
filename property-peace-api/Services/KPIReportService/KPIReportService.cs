using brownstone_hub_api.Dtos.KPIReports;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.Expenses;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.KPIReportService
{
    public class KPIReportService(
        IPropertyRepository propertyRepository,
        ILeaseRepository leaseRepository,
        IPaymentRepository paymentRepository,
        IUnitRepository unitRepository,
        IExpenseRepository expenseRepository,
        ILogger<KPIReportService> logger) : IKPIReportService
    {
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly IUnitRepository _unitRepository = unitRepository;
        private readonly IExpenseRepository _expenseRepository = expenseRepository;
        private readonly ILogger<KPIReportService> _logger = logger;

        private (DateTime startDate, DateTime endDate) GetDateRange(string? timeRange, DateTime? startDate = null, DateTime? endDate = null)
        {
            if (startDate.HasValue && endDate.HasValue)
            {
                return (startDate.Value, endDate.Value);
            }

            var now = DateTime.UtcNow;
            return timeRange switch
            {
                "3months" => (now.AddMonths(-3), now),
                "6months" => (now.AddMonths(-6), now),
                "12months" => (now.AddMonths(-12), now),
                "all" => (DateTime.MinValue, now),
                _ => (now.AddMonths(-12), now)
            };
        }

        public async Task<ServiceResponse<OccupancyReportDto>> GetOccupancyReport(long organizationId, List<long>? propertyIds = null, List<long>? unitIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null)
        {
            try
            {
                var (start, end) = GetDateRange(timeRange, startDate, endDate);
                var properties = await _propertyRepository.GetPropertiesByOrganizationId(organizationId);
                
                if (propertyIds != null && propertyIds.Any())
                {
                    properties = properties?.Where(p => propertyIds.Contains(p.Id)).ToList();
                }

                if (properties == null || !properties.Any())
                {
                    return ServiceResponse<OccupancyReportDto>.CreateSuccess(new OccupancyReportDto());
                }

                var filteredPropertyIds = properties.Select(p => p.Id).ToList();
                var allUnits = await _unitRepository.GetUnitsByPropertyIds(filteredPropertyIds, organizationId);
                if (unitIds != null && unitIds.Any())
                {
                    allUnits = allUnits.Where(u => unitIds.Contains(u.Id)).ToList();
                }

                var totalUnits = allUnits.Count;
                var occupiedUnits = allUnits.Count(u => u.Lease != null || u.IsOccupied);
                var vacantUnits = totalUnits - occupiedUnits;
                var occupancyRate = totalUnits > 0 ? (decimal)occupiedUnits / totalUnits * 100 : 0;
                var vacancyRate = totalUnits > 0 ? (decimal)vacantUnits / totalUnits * 100 : 0;

                var occupancyByProperty = properties.Select(p => new OccupancyByPropertyDto
                {
                    PropertyId = p.Id,
                    PropertyName = p.Name,
                    OccupiedUnits = allUnits.Count(u => u.PropertyId == p.Id && (u.Lease != null || u.IsOccupied)),
                    TotalUnits = allUnits.Count(u => u.PropertyId == p.Id),
                    OccupancyRate = allUnits.Count(u => u.PropertyId == p.Id) > 0
                        ? (decimal)allUnits.Count(u => u.PropertyId == p.Id && (u.Lease != null || u.IsOccupied)) / allUnits.Count(u => u.PropertyId == p.Id) * 100
                        : 0
                }).ToList();

                var result = new OccupancyReportDto
                {
                    OccupancyRate = occupancyRate,
                    VacancyRate = vacancyRate,
                    OccupiedUnits = occupiedUnits,
                    VacantUnits = vacantUnits,
                    TotalUnits = totalUnits,
                    OccupancyByProperty = occupancyByProperty,
                    OccupancyHistory = new List<OccupancyHistoryDto>() // TODO: Implement historical data
                };

                return ServiceResponse<OccupancyReportDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving occupancy report");
                return ServiceResponse<OccupancyReportDto>.CreateError("Error retrieving occupancy report", ex.Message);
            }
        }

        public async Task<ServiceResponse<RevenuePerUnitDto>> GetRevenuePerUnitReport(long organizationId, List<long>? propertyIds = null, List<long>? unitIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null)
        {
            try
            {
                var (start, end) = GetDateRange(timeRange, startDate, endDate);
                var properties = await _propertyRepository.GetPropertiesByOrganizationId(organizationId);
                
                if (propertyIds != null && propertyIds.Any())
                {
                    properties = properties?.Where(p => propertyIds.Contains(p.Id)).ToList();
                }

                if (properties == null || !properties.Any())
                {
                    return ServiceResponse<RevenuePerUnitDto>.CreateSuccess(new RevenuePerUnitDto());
                }

                var filteredPropertyIds = properties.Select(p => p.Id).ToList();
                var allUnits = await _unitRepository.GetUnitsByPropertyIds(filteredPropertyIds, organizationId);
                if (unitIds != null && unitIds.Any())
                {
                    allUnits = allUnits.Where(u => unitIds.Contains(u.Id)).ToList();
                }

                var totalUnits = allUnits.Count;
                var allPayments = await _paymentRepository.GetPaymentsByPropertyIds(filteredPropertyIds, start, end);
                var totalRevenue = allPayments.Values.SelectMany(p => p).Sum(p => p.Amount);
                var averageRPU = totalUnits > 0 ? totalRevenue / totalUnits : 0;

                var rpuByProperty = properties.Select(p =>
                {
                    var propertyUnitCount = allUnits.Count(u => u.PropertyId == p.Id);
                    var propertyRevenue = allPayments.TryGetValue(p.Id, out var payments) ? payments.Sum(x => x.Amount) : 0;
                    return new RPUByPropertyDto
                    {
                        PropertyId = p.Id,
                        PropertyName = p.Name,
                        RPU = propertyUnitCount > 0 ? propertyRevenue / propertyUnitCount : 0,
                        TotalRevenue = propertyRevenue,
                        UnitCount = propertyUnitCount
                    };
                }).ToList();

                var result = new RevenuePerUnitDto
                {
                    AverageRPU = averageRPU,
                    TotalRevenue = totalRevenue,
                    TotalUnits = totalUnits,
                    RPUByProperty = rpuByProperty,
                    RPUHistory = new List<RPUHistoryDto>() // TODO: Implement historical data
                };

                return ServiceResponse<RevenuePerUnitDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving revenue per unit report");
                return ServiceResponse<RevenuePerUnitDto>.CreateError("Error retrieving revenue per unit report", ex.Message);
            }
        }

        public async Task<ServiceResponse<UnitsPerClientDto>> GetUnitsPerClientReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null)
        {
            try
            {
                var properties = await _propertyRepository.GetPropertiesByOrganizationId(organizationId);
                
                if (propertyIds != null && propertyIds.Any())
                {
                    properties = properties?.Where(p => propertyIds.Contains(p.Id)).ToList();
                }

                if (properties == null || !properties.Any())
                {
                    return ServiceResponse<UnitsPerClientDto>.CreateSuccess(new UnitsPerClientDto());
                }

                var filteredPropertyIds = properties.Select(p => p.Id).ToList();
                var allUnits = await _unitRepository.GetUnitsByPropertyIds(filteredPropertyIds, organizationId);

                var clientUnits = new Dictionary<long, int>(); // Group by LandlordId
                foreach (var property in properties)
                {
                    var propertyUnitCount = allUnits.Count(u => u.PropertyId == property.Id);
                    if (!clientUnits.ContainsKey(property.LandlordId))
                        clientUnits[property.LandlordId] = 0;
                    clientUnits[property.LandlordId] += propertyUnitCount;
                }

                var totalClients = clientUnits.Count;
                var totalUnits = clientUnits.Values.Sum();
                var averageUnitsPerClient = totalClients > 0 ? (decimal)totalUnits / totalClients : 0;

                var clientDistribution = clientUnits.Select(kvp => new ClientDistributionDto
                {
                    ClientName = $"Client {kvp.Key}",
                    Units = kvp.Value
                }).ToList();

                var topClients = clientDistribution.OrderByDescending(c => c.Units).Take(10).Select(c => new TopClientDto
                {
                    ClientName = c.ClientName,
                    UnitCount = c.Units
                }).ToList();

                var result = new UnitsPerClientDto
                {
                    AverageUnitsPerClient = averageUnitsPerClient,
                    TotalClients = totalClients,
                    TotalUnits = totalUnits,
                    ClientDistribution = clientDistribution,
                    TopClients = topClients
                };

                return ServiceResponse<UnitsPerClientDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving units per client report");
                return ServiceResponse<UnitsPerClientDto>.CreateError("Error retrieving units per client report", ex.Message);
            }
        }

        public Task<ServiceResponse<ClientChurnDto>> GetClientChurnReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null)
        {
            try
            {
                var (start, end) = GetDateRange(timeRange, startDate, endDate);
                // TODO: Implement client churn calculation
                var result = new ClientChurnDto
                {
                    ChurnRate = 0,
                    UnitsLost = 0,
                    UnitsStartedWith = 0,
                    ChurnHistory = new List<ChurnHistoryDto>(),
                    ChurnReasons = new List<ChurnReasonDto>()
                };

                return Task.FromResult(ServiceResponse<ClientChurnDto>.CreateSuccess(result));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving client churn report");
                return Task.FromResult(ServiceResponse<ClientChurnDto>.CreateError("Error retrieving client churn report", ex.Message));
            }
        }

        public Task<ServiceResponse<UnitsPerEmployeeDto>> GetUnitsPerEmployeeReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null)
        {
            try
            {
                // TODO: Implement units per employee calculation
                var result = new UnitsPerEmployeeDto
                {
                    UnitsPerEmployee = 0,
                    TotalUnits = 0,
                    TotalEmployees = 0,
                    EmployeePerformance = new List<EmployeePerformanceDto>()
                };

                return Task.FromResult(ServiceResponse<UnitsPerEmployeeDto>.CreateSuccess(result));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving units per employee report");
                return Task.FromResult(ServiceResponse<UnitsPerEmployeeDto>.CreateError("Error retrieving units per employee report", ex.Message));
            }
        }

        public Task<ServiceResponse<ClosingRateDto>> GetClosingRateReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null)
        {
            try
            {
                // TODO: Implement closing rate calculation
                var result = new ClosingRateDto
                {
                    ClosingRate = 0,
                    WonCustomers = 0,
                    TotalLeads = 0,
                    ClosingRateHistory = new List<ClosingRateHistoryDto>(),
                    ConversionBySource = new List<ConversionBySourceDto>()
                };

                return Task.FromResult(ServiceResponse<ClosingRateDto>.CreateSuccess(result));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving closing rate report");
                return Task.FromResult(ServiceResponse<ClosingRateDto>.CreateError("Error retrieving closing rate report", ex.Message));
            }
        }

        public Task<ServiceResponse<MedianDOMDto>> GetMedianDOMReport(long organizationId, List<long>? propertyIds = null, List<long>? unitIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null)
        {
            try
            {
                // TODO: Implement median DOM calculation
                var result = new MedianDOMDto
                {
                    MedianDOM = 0,
                    AverageDOM = 0,
                    TotalUnitsLeased = 0,
                    DOMByProperty = new List<DOMByPropertyDto>()
                };

                return Task.FromResult(ServiceResponse<MedianDOMDto>.CreateSuccess(result));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving median DOM report");
                return Task.FromResult(ServiceResponse<MedianDOMDto>.CreateError("Error retrieving median DOM report", ex.Message));
            }
        }

        public Task<ServiceResponse<MedianTTTDto>> GetMedianTTTReport(long organizationId, List<long>? propertyIds = null, List<long>? unitIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null)
        {
            try
            {
                // TODO: Implement median TTT calculation
                var result = new MedianTTTDto
                {
                    MedianTTT = 0,
                    AverageTTT = 0,
                    TotalTurnovers = 0,
                    TTTByProperty = new List<TTTByPropertyDto>()
                };

                return Task.FromResult(ServiceResponse<MedianTTTDto>.CreateSuccess(result));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving median TTT report");
                return Task.FromResult(ServiceResponse<MedianTTTDto>.CreateError("Error retrieving median TTT report", ex.Message));
            }
        }

        public Task<ServiceResponse<NPSDto>> GetNPSClientReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null)
        {
            try
            {
                // TODO: Implement NPS client calculation
                var result = new NPSDto
                {
                    NPSScore = 0,
                    Promoters = 0,
                    Detractors = 0,
                    Passives = 0,
                    TotalResponses = 0,
                    NPSHistory = new List<NPSHistoryDto>()
                };

                return Task.FromResult(ServiceResponse<NPSDto>.CreateSuccess(result));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving NPS client report");
                return Task.FromResult(ServiceResponse<NPSDto>.CreateError("Error retrieving NPS client report", ex.Message));
            }
        }

        public Task<ServiceResponse<NPSDto>> GetNPSTenantReport(long organizationId, List<long>? propertyIds = null, DateTime? startDate = null, DateTime? endDate = null, string? timeRange = null)
        {
            try
            {
                // TODO: Implement NPS tenant calculation
                var result = new NPSDto
                {
                    NPSScore = 0,
                    Promoters = 0,
                    Detractors = 0,
                    Passives = 0,
                    TotalResponses = 0,
                    NPSHistory = new List<NPSHistoryDto>()
                };

                return Task.FromResult(ServiceResponse<NPSDto>.CreateSuccess(result));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving NPS tenant report");
                return Task.FromResult(ServiceResponse<NPSDto>.CreateError("Error retrieving NPS tenant report", ex.Message));
            }
        }
    }
}
