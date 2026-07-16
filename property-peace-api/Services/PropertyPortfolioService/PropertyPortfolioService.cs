using brownstone_hub_api.Dtos.PropertyPortfolio;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Expenses;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.PropertyPortfolioService
{
    public class PropertyPortfolioService(
        IPropertyRepository propertyRepository,
        ILeaseRepository leaseRepository,
        IPaymentRepository paymentRepository,
        IExpenseRepository expenseRepository,
        ILogger<PropertyPortfolioService> logger) : IPropertyPortfolioService
    {
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly IExpenseRepository _expenseRepository = expenseRepository;
        private readonly ILogger<PropertyPortfolioService> _logger = logger;

        public async Task<ServiceResponse<PropertyPortfolioAnalyticsDto>> GetPropertyPortfolioAnalytics(long landlordId, long? propertyId, string timeRange)
        {
            try
            {
                var analytics = new PropertyPortfolioAnalyticsDto();

                // Get properties
                var properties = await _propertyRepository.GetPropertiesByLandlordId(landlordId);
                if (propertyId.HasValue)
                {
                    properties = properties?.Where(p => p.Id == propertyId.Value).ToList();
                }

                if (properties == null || !properties.Any())
                {
                    return ServiceResponse<PropertyPortfolioAnalyticsDto>.CreateSuccess(analytics, "No properties found");
                }

                // Calculate time range
                var (startDate, endDate) = GetDateRange(timeRange);
                var monthsInRange = GetMonthsInRange(startDate, endDate);

                // Get leases and payments for the time range
                var leases = await _leaseRepository.GetLeasesByLandlordId(landlordId);
                if (propertyId.HasValue)
                {
                    leases = leases?.Where(l => l.PropertyId == propertyId.Value).ToList();
                }

                List<LoadPaymentDto> payments;
                if (propertyId.HasValue)
                {
                    // Get payments for specific property
                    payments = await _paymentRepository.GetPaymentsByPropertyId(propertyId.Value, startDate, endDate) ?? [];
                }
                else
                {
                    // Get all payments for landlord and filter by date range
                    var allPayments = await _paymentRepository.GetLifetimePaymentsByLandlordId(landlordId);
                    payments = allPayments?.Where(p => p.PaymentDate >= startDate && p.PaymentDate <= endDate).ToList() ?? [];
                }

                // Get expenses
                var expenses = await _expenseRepository.GetExpensesByLandlordId(landlordId, propertyId, startDate, endDate);

                // Calculate ROI for each property
                var propertyROIList = new List<PropertyROIDto>();
                var propertyPerformanceList = new List<PropertyPerformanceDto>();

                foreach (var property in properties)
                {
                    var propertyLeases = leases?.Where(l => l.PropertyId == property.Id).ToList() ?? [];
                    var leaseIds = propertyLeases.Select(l => l.Id).ToList();
                    var propertyPayments = payments?.Where(p => leaseIds.Contains(p.LeaseId)).ToList() ?? [];
                    var propertyExpenses = expenses?.Where(e => e.PropertyId == property.Id).ToList() ?? [];

                    var totalIncome = propertyPayments?.Sum(p => p.Amount) ?? 0;
                    var totalExpenses = propertyExpenses?.Sum(e => e.Amount) ?? 0;
                    var netIncome = totalIncome - totalExpenses;

                    // Calculate ROI using a simple calculation based on total investment
                    // ROI = (Net Income / Total Investment) * 100
                    // For now, we'll estimate property value based on annual income (10x multiplier)
                    var annualIncome = monthsInRange > 0 ? totalIncome * (12m / monthsInRange) : 0;
                    var estimatedPropertyValue = annualIncome * 10; // Rough estimate
                    var roi = estimatedPropertyValue > 0 ? (netIncome / estimatedPropertyValue) * 100 : 0;

                    propertyROIList.Add(new PropertyROIDto
                    {
                        PropertyId = property.Id,
                        PropertyName = property.Name,
                        ROI = roi
                    });

                    propertyPerformanceList.Add(new PropertyPerformanceDto
                    {
                        PropertyId = property.Id,
                        PropertyName = property.Name,
                        Income = totalIncome,
                        Expenses = totalExpenses,
                        ROI = roi
                    });
                }

                analytics.PropertyROI = propertyROIList;
                analytics.PropertyPerformance = propertyPerformanceList;

                // Calculate average ROI
                analytics.AverageROI = propertyROIList.Any() ? propertyROIList.Average(p => p.ROI) : 0;

                // Calculate vacancy and occupancy rates based on active leases
                var totalUnits = properties.Sum(p => p.Units?.Count ?? 0);
                var today = DateTime.UtcNow.Date;
                var occupiedUnits = properties.Sum(p => p.Units?.Count(u => 
                    u.Lease != null && 
                    u.Lease.IsActive && 
                    u.Lease.EndDate.HasValue &&
                    u.Lease.EndDate.Value >= today) ?? 0);
                var vacantUnits = totalUnits - occupiedUnits;

                analytics.VacancyRate = totalUnits > 0 ? (vacantUnits / (decimal)totalUnits) * 100 : 0;
                analytics.OccupancyRate = totalUnits > 0 ? (occupiedUnits / (decimal)totalUnits) * 100 : 0;

                // Calculate total estimated market value (based on income)
                var totalPayments = payments?.Sum(p => p.Amount) ?? 0;
                var totalAnnualIncome = monthsInRange > 0 ? totalPayments * (12m / monthsInRange) : 0;
                analytics.TotalMarketValue = totalAnnualIncome * 10; // Rough estimate

                // Generate occupancy history (monthly for the time range)
                analytics.OccupancyHistory = GenerateOccupancyHistory(properties, leases, startDate, endDate);

                // Market value history (if available)
                analytics.MarketValueHistory = GenerateMarketValueHistory(properties, timeRange);

                return ServiceResponse<PropertyPortfolioAnalyticsDto>.CreateSuccess(analytics, "Analytics retrieved successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving property portfolio analytics for landlord {LandlordId}", landlordId);
                return ServiceResponse<PropertyPortfolioAnalyticsDto>.CreateError("Error retrieving analytics", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<PropertyOccupancyDto>> GetPropertyOccupancyData(long landlordId, long? propertyId)
        {
            try
            {
                var occupancy = new PropertyOccupancyDto();

                // Get properties
                var properties = await _propertyRepository.GetPropertiesByLandlordId(landlordId);
                if (propertyId.HasValue)
                {
                    properties = properties?.Where(p => p.Id == propertyId.Value).ToList();
                }

                if (properties == null || !properties.Any())
                {
                    return ServiceResponse<PropertyOccupancyDto>.CreateSuccess(occupancy, "No properties found");
                }

                // Get leases to calculate turnover
                var leases = await _leaseRepository.GetLeasesByLandlordId(landlordId);
                if (propertyId.HasValue)
                {
                    leases = leases?.Where(l => l.PropertyId == propertyId.Value).ToList();
                }

                // Calculate vacancy costs (last 12 months)
                var twelveMonthsAgo = DateTime.UtcNow.AddMonths(-12);
                var vacancyCostByPropertyList = new List<VacancyCostByPropertyDto>();
                var totalVacancyCost = 0m;
                var totalDaysVacant = 0;
                var propertyCount = 0;

                foreach (var property in properties)
                {
                    var propertyLeases = leases?.Where(l => l.PropertyId == property.Id).ToList() ?? [];
                    var propertyUnits = property.Units?.ToList() ?? [];

                    // Calculate vacancy periods and costs
                    var propertyVacancyCost = 0m;
                    var propertyDaysVacant = 0;

                    foreach (var unit in propertyUnits)
                    {
                        var unitLeases = propertyLeases.Where(l => l.UnitId == unit.Id)
                            .OrderBy(l => l.StartDate)
                            .ToList();

                        // Find gaps between leases (vacancy periods)
                        for (int i = 0; i < unitLeases.Count - 1; i++)
                        {
                            var currentLease = unitLeases[i];
                            var nextLease = unitLeases[i + 1];
                            if (!currentLease.EndDate.HasValue || !nextLease.StartDate.HasValue || !currentLease.RentAmount.HasValue)
                                continue;
                                
                            var gapStart = currentLease.EndDate.Value;
                            var gapEnd = nextLease.StartDate.Value;

                            if (gapStart < gapEnd && gapStart >= twelveMonthsAgo)
                            {
                                var daysVacant = (gapEnd - gapStart).Days;
                                var monthlyRent = currentLease.RentAmount.Value;
                                var dailyRent = monthlyRent / 30; // Approximate
                                var cost = daysVacant * dailyRent;

                                propertyDaysVacant += daysVacant;
                                propertyVacancyCost += cost;
                            }
                        }

                        // Check if unit is currently vacant (no active lease that hasn't ended)
                        var today = DateTime.UtcNow.Date;
                        var hasActiveLease = unitLeases.Any(l => 
                            l.IsActive && 
                            l.EndDate >= today);
                        
                        if (!hasActiveLease)
                        {
                            var lastLease = unitLeases
                                .Where(l => l.IsActive)
                                .OrderByDescending(l => l.EndDate)
                                .FirstOrDefault();
                            if (lastLease != null && lastLease.EndDate.HasValue && lastLease.RentAmount.HasValue && lastLease.EndDate.Value >= twelveMonthsAgo)
                            {
                                var daysVacant = (DateTime.UtcNow - lastLease.EndDate.Value).Days;
                                var monthlyRent = lastLease.RentAmount.Value;
                                var dailyRent = monthlyRent / 30;
                                var cost = daysVacant * dailyRent;

                                propertyDaysVacant += daysVacant;
                                propertyVacancyCost += cost;
                            }
                        }
                    }

                    if (propertyVacancyCost > 0)
                    {
                        vacancyCostByPropertyList.Add(new VacancyCostByPropertyDto
                        {
                            PropertyId = property.Id,
                            PropertyName = property.Name,
                            VacancyCost = propertyVacancyCost
                        });

                        totalVacancyCost += propertyVacancyCost;
                        totalDaysVacant += propertyDaysVacant;
                        propertyCount++;
                    }
                }

                occupancy.VacancyCostByProperty = vacancyCostByPropertyList;
                occupancy.TotalVacancyCost = totalVacancyCost;
                occupancy.AverageDaysVacant = propertyCount > 0 ? (decimal)totalDaysVacant / propertyCount : 0;

                // Calculate tenant turnover
                var turnoverByPropertyList = new List<TurnoverByPropertyDto>();
                var totalTurnovers = 0;

                foreach (var property in properties)
                {
                    var propertyLeases = leases?.Where(l => l.PropertyId == property.Id).ToList() ?? [];
                    var turnovers = propertyLeases.Count(l => l.EndDate >= twelveMonthsAgo && l.EndDate < DateTime.UtcNow);

                    if (turnovers > 0)
                    {
                        turnoverByPropertyList.Add(new TurnoverByPropertyDto
                        {
                            PropertyId = property.Id,
                            PropertyName = property.Name,
                            Turnovers = turnovers
                        });

                        totalTurnovers += turnovers;
                    }
                }

                occupancy.TurnoverByProperty = turnoverByPropertyList;
                occupancy.TotalTurnovers = totalTurnovers;

                // Calculate average turnover rate
                var totalUnits = properties.Sum(p => p.Units?.Count ?? 0);
                occupancy.AverageTurnoverRate = totalUnits > 0 ? (totalTurnovers / (decimal)totalUnits) * 100 : 0;

                // Generate rent pricing suggestions
                occupancy.RentPricingSuggestions = GenerateRentPricingSuggestions(properties, leases);

                return ServiceResponse<PropertyOccupancyDto>.CreateSuccess(occupancy, "Occupancy data retrieved successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving property occupancy data for landlord {LandlordId}", landlordId);
                return ServiceResponse<PropertyOccupancyDto>.CreateError("Error retrieving occupancy data", ex.Message, ex.InnerException?.Message);
            }
        }

        private (DateTime startDate, DateTime endDate) GetDateRange(string timeRange)
        {
            var endDate = DateTime.UtcNow;
            var startDate = timeRange switch
            {
                "3months" => endDate.AddMonths(-3),
                "6months" => endDate.AddMonths(-6),
                "12months" => endDate.AddMonths(-12),
                "all" => DateTime.MinValue,
                _ => endDate.AddMonths(-12)
            };

            return (startDate, endDate);
        }

        private List<OccupancyHistoryDto> GenerateOccupancyHistory(List<LoadPropertyDto> properties, List<LoadLeaseDto> leases, DateTime startDate, DateTime endDate)
        {
            var history = new List<OccupancyHistoryDto>();
            var currentDate = startDate;

            while (currentDate <= endDate)
            {
                var monthStart = new DateTime(currentDate.Year, currentDate.Month, 1);
                var monthEnd = monthStart.AddMonths(1);

                var totalUnits = properties.Sum(p => p.Units?.Count ?? 0);
                var occupiedUnits = 0;

                // Count occupied units for this month
                foreach (var property in properties)
                {
                    var propertyUnits = property.Units?.ToList() ?? [];
                    var propertyLeases = leases?.Where(l => l.PropertyId == property.Id).ToList() ?? [];

                    foreach (var unit in propertyUnits)
                    {
                        var unitLeases = propertyLeases.Where(l => 
                            l.UnitId == unit.Id && 
                            l.IsActive &&
                            l.StartDate <= monthStart && 
                            l.EndDate >= monthStart).ToList();
                        
                        if (unitLeases.Any()) occupiedUnits++;
                    }
                }

                var occupancyRate = totalUnits > 0 ? (occupiedUnits / (decimal)totalUnits) * 100 : 0;

                history.Add(new OccupancyHistoryDto
                {
                    Month = monthStart.ToString("MMM yyyy"),
                    OccupancyRate = occupancyRate
                });

                currentDate = monthEnd;
            }

            return history;
        }

        private List<MarketValueHistoryDto> GenerateMarketValueHistory(List<LoadPropertyDto> properties, string timeRange)
        {
            // For now, return estimated market values based on income
            // In a real implementation, you'd track historical market values
            var history = new List<MarketValueHistoryDto>();

            // Estimate based on property units and average rent
            var totalValue = 0m;
            foreach (var property in properties)
            {
                var unitsWithRent = property.Units?.Where(u => u.RentAmount > 0).ToList() ?? [];
                var avgRent = unitsWithRent.Any() ? unitsWithRent.Average(u => u.RentAmount) : 0;
                var unitCount = property.Units?.Count ?? 1;
                var annualIncome = avgRent * unitCount * 12;
                totalValue += annualIncome * 10; // Rough estimate
            }

            history.Add(new MarketValueHistoryDto
            {
                Date = DateTime.UtcNow.ToString("MMM yyyy"),
                MarketValue = totalValue
            });

            return history;
        }

        private List<RentPricingSuggestionDto> GenerateRentPricingSuggestions(List<LoadPropertyDto> properties, List<LoadLeaseDto> leases)
        {
            var suggestions = new List<RentPricingSuggestionDto>();

            foreach (var property in properties)
            {
                var propertyUnits = property.Units?.ToList() ?? [];
                var propertyLeases = leases?.Where(l => l.PropertyId == property.Id).ToList() ?? [];

                foreach (var unit in propertyUnits)
                {
                    var currentLease = propertyLeases
                        .Where(l => l.UnitId == unit.Id && l.EndDate.HasValue && l.EndDate.Value >= DateTime.UtcNow && l.IsActive)
                        .OrderByDescending(l => l.StartDate)
                        .FirstOrDefault();

                    if (currentLease != null)
                    {
                        var currentRent = currentLease.RentAmount ?? 0m;
                        var unitRent = unit.RentAmount;

                        // Calculate average rent for similar units in the property
                        var similarUnits = propertyUnits.Where(u => u.Type == unit.Type && u.RentAmount > 0).ToList();
                        var avgRent = similarUnits.Any() ? similarUnits.Average(u => u.RentAmount) : currentRent;

                        // Suggest 3-5% increase if average is higher, or suggest matching average
                        var suggestedRent = avgRent > currentRent ? Math.Min(currentRent * 1.05m, avgRent) : currentRent;
                        var reason = avgRent > currentRent
                            ? $"Similar units average ${avgRent:F2}. Consider increasing to ${suggestedRent:F2}."
                            : "Current rent aligns with similar units in the property.";

                        suggestions.Add(new RentPricingSuggestionDto
                        {
                            PropertyId = property.Id,
                            PropertyName = property.Name,
                            UnitId = unit.Id,
                            UnitName = unit.Name,
                            CurrentRent = currentRent,
                            SuggestedRent = suggestedRent,
                            Reason = reason
                        });
                    }
                }
            }

            return suggestions;
        }

        public async Task<ServiceResponse<UnitAvailabilityCalendarDto>> GetUnitAvailabilityCalendar(long landlordId, long? propertyId, DateTime? startDate, DateTime? endDate)
        {
            try
            {
                // Default to 6 months view if dates not provided
                var calendarStartDate = startDate ?? DateTime.UtcNow.Date;
                var calendarEndDate = endDate ?? DateTime.UtcNow.Date.AddMonths(6);

                var calendar = new UnitAvailabilityCalendarDto
                {
                    StartDate = calendarStartDate,
                    EndDate = calendarEndDate
                };

                // Get properties
                var properties = await _propertyRepository.GetPropertiesByLandlordId(landlordId);
                if (propertyId.HasValue)
                {
                    properties = properties?.Where(p => p.Id == propertyId.Value).ToList();
                }

                if (properties == null || !properties.Any())
                {
                    return ServiceResponse<UnitAvailabilityCalendarDto>.CreateSuccess(calendar, "No properties found");
                }

                // Get leases (including inactive ones for complete calendar view)
                var leases = await _leaseRepository.GetLeasesByLandlordId(landlordId, isActive: false);
                if (propertyId.HasValue)
                {
                    leases = leases?.Where(l => l.PropertyId == propertyId.Value).ToList();
                }

                var unitAvailabilityList = new List<UnitAvailabilityDto>();

                foreach (var property in properties)
                {
                    var propertyUnits = property.Units?.ToList() ?? [];
                    var propertyLeases = leases?.Where(l => l.PropertyId == property.Id).ToList() ?? [];

                    foreach (var unit in propertyUnits)
                    {
                        var unitLeases = propertyLeases
                            .Where(l => l.UnitId == unit.Id)
                            .OrderBy(l => l.StartDate)
                            .ToList();

                        var leasePeriods = unitLeases.Select(l => new LeasePeriodDto
                        {
                            LeaseId = l.Id,
                            StartDate = l.StartDate ?? DateTime.UtcNow,
                            EndDate = l.EndDate ?? DateTime.UtcNow,
                            IsActive = l.IsActive,
                            RentAmount = l.RentAmount ?? 0m,
                            TenantNames = string.Join(", ", l.Tenants?.Select(t => $"{t.Firstname} {t.Lastname}") ?? []),
                            RentDueDay = l.RentDueDay
                        }).ToList();

                        // Calculate availability periods (vacant periods)
                        var availabilityPeriods = new List<AvailabilityPeriodDto>();

                        // Add occupied periods from leases
                        foreach (var lease in unitLeases.Where(l => l.StartDate.HasValue && l.EndDate.HasValue))
                        {
                            var leaseStart = lease.StartDate!.Value.Date;
                            var leaseEnd = lease.EndDate!.Value.Date;

                            // Only include if it overlaps with calendar range
                            if (leaseEnd >= calendarStartDate && leaseStart <= calendarEndDate)
                            {
                                availabilityPeriods.Add(new AvailabilityPeriodDto
                                {
                                    StartDate = leaseStart < calendarStartDate ? calendarStartDate : leaseStart,
                                    EndDate = leaseEnd > calendarEndDate ? calendarEndDate : leaseEnd,
                                    IsVacant = false,
                                    Status = lease.IsActive ? "Occupied" : "Expired"
                                });
                            }
                        }

                        // Find vacant periods (gaps between leases and before/after)
                        var sortedLeases = unitLeases
                            .Where(l => l.EndDate >= calendarStartDate && l.StartDate <= calendarEndDate)
                            .OrderBy(l => l.StartDate)
                            .ToList();

                        // Vacant period before first lease
                        if (sortedLeases.Any())
                        {
                            var firstLease = sortedLeases.First();
                            if (firstLease.StartDate > calendarStartDate)
                            {
                                availabilityPeriods.Add(new AvailabilityPeriodDto
                                {
                                    StartDate = calendarStartDate,
                                    EndDate = firstLease.StartDate!.Value.AddDays(-1),
                                    IsVacant = true,
                                    Status = "Vacant"
                                });
                            }
                        }
                        else
                        {
                            // No leases in range - entire period is vacant
                            availabilityPeriods.Add(new AvailabilityPeriodDto
                            {
                                StartDate = calendarStartDate,
                                EndDate = calendarEndDate,
                                IsVacant = true,
                                Status = "Vacant"
                            });
                        }

                        // Vacant periods between leases
                        for (int i = 0; i < sortedLeases.Count - 1; i++)
                        {
                            var currentLease = sortedLeases[i];
                            var nextLease = sortedLeases[i + 1];
                            if (!currentLease.EndDate.HasValue || !nextLease.StartDate.HasValue)
                                continue;
                                
                            var gapStart = currentLease.EndDate.Value.AddDays(1);
                            var gapEnd = nextLease.StartDate.Value.AddDays(-1);

                            if (gapStart < gapEnd && gapStart <= calendarEndDate && gapEnd >= calendarStartDate)
                            {
                                availabilityPeriods.Add(new AvailabilityPeriodDto
                                {
                                    StartDate = gapStart < calendarStartDate ? calendarStartDate : gapStart,
                                    EndDate = gapEnd > calendarEndDate ? calendarEndDate : gapEnd,
                                    IsVacant = true,
                                    Status = "Vacant"
                                });
                            }
                        }

                        // Vacant period after last lease
                        if (sortedLeases.Any())
                        {
                            var lastLease = sortedLeases.Last();
                            if (lastLease.EndDate.HasValue && lastLease.EndDate.Value < calendarEndDate)
                            {
                                var vacantStart = lastLease.EndDate.Value.AddDays(1);
                                if (vacantStart <= calendarEndDate)
                                {
                                    availabilityPeriods.Add(new AvailabilityPeriodDto
                                    {
                                        StartDate = vacantStart,
                                        EndDate = calendarEndDate,
                                        IsVacant = true,
                                        Status = "Vacant"
                                    });
                                }
                            }
                        }

                        // Sort availability periods by start date
                        availabilityPeriods = availabilityPeriods.OrderBy(a => a.StartDate).ToList();

                        unitAvailabilityList.Add(new UnitAvailabilityDto
                        {
                            UnitId = unit.Id,
                            UnitName = unit.Name,
                            PropertyId = property.Id,
                            PropertyName = property.Name,
                            AvailabilityPeriods = availabilityPeriods,
                            LeasePeriods = leasePeriods
                        });
                    }
                }

                calendar.Units = unitAvailabilityList;

                return ServiceResponse<UnitAvailabilityCalendarDto>.CreateSuccess(calendar, "Calendar data retrieved successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving unit availability calendar for landlord {LandlordId}", landlordId);
                return ServiceResponse<UnitAvailabilityCalendarDto>.CreateError("Error retrieving calendar data", ex.Message, ex.InnerException?.Message);
            }
        }

        private decimal GetMonthsInRange(DateTime startDate, DateTime endDate)
        {
            var months = (endDate.Year - startDate.Year) * 12 + (endDate.Month - startDate.Month);
            return Math.Max(months, 1); // At least 1 month
        }
    }
}

