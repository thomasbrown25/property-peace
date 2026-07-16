using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Dtos.ExpenseReport;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using Microsoft.EntityFrameworkCore;
using brownstone_hub_api.Data;

namespace brownstone_hub_api.Services.ExpenseReportService
{
    public class ExpenseReportService(
        IExpenseRepository expenseRepository,
        IPaymentRepository paymentRepository,
        IPropertyRepository propertyRepository,
        DataContext context,
        ILogger<ExpenseReportService> logger) : IExpenseReportService
    {
        private readonly IExpenseRepository _expenseRepository = expenseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly DataContext _context = context;
        private readonly ILogger<ExpenseReportService> _logger = logger;

        public async Task<ServiceResponse<List<ExpenseReportDto>>> GetExpenseReport(
            long organizationId,
            long? propertyId = null,
            long? unitId = null,
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? category = null,
            long? vendorId = null)
        {
            try
            {
                var expenses = await _expenseRepository.GetExpensesByOrganizationId(
                    organizationId, propertyId, startDate, endDate, category, vendorId);

                var reportDtos = expenses.Select(e => new ExpenseReportDto
                {
                    Id = e.Id,
                    PropertyId = e.PropertyId,
                    PropertyName = e.PropertyName,
                    UnitId = e.UnitId,
                    UnitName = e.UnitName,
                    Name = e.Name,
                    Category = e.Category,
                    Amount = e.Amount,
                    ExpenseDate = e.ExpenseDate,
                    Vendor = e.Vendor, // Legacy field
                    VendorId = e.VendorId,
                    VendorName = e.VendorName ?? e.Vendor, // Fallback to legacy field if needed
                    PaymentMethod = e.PaymentMethod,
                    IsTaxDeductible = e.IsTaxDeductible,
                    IsRecurring = e.IsRecurring
                }).ToList();

                return new ServiceResponse<List<ExpenseReportDto>> { Data = reportDtos };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expense report");
                return ServiceResponse<List<ExpenseReportDto>>.CreateError("Error retrieving expense report", ex.Message);
            }
        }

        public async Task<ServiceResponse<ExpenseReportSummaryDto>> GetExpenseReportSummary(
            long organizationId,
            long? propertyId = null,
            long? unitId = null,
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? category = null,
            long? vendorId = null)
        {
            try
            {
                var expenses = await _expenseRepository.GetExpensesByOrganizationId(
                    organizationId, propertyId, startDate, endDate, category, vendorId);

                if (unitId.HasValue)
                {
                    expenses = expenses.Where(e => e.UnitId == unitId.Value).ToList();
                }

                if (!expenses.Any())
                {
                    return new ServiceResponse<ExpenseReportSummaryDto>
                    {
                        Data = new ExpenseReportSummaryDto
                        {
                            TotalAmount = 0,
                            TotalCount = 0,
                            AverageAmount = 0,
                            StartDate = startDate,
                            EndDate = endDate
                        }
                    };
                }

                var totalAmount = expenses.Sum(e => e.Amount);
                var totalCount = expenses.Count;
                var averageAmount = totalAmount / totalCount;
                var minAmount = expenses.Min(e => e.Amount);
                var maxAmount = expenses.Max(e => e.Amount);

                // Category breakdown
                var byCategory = expenses
                    .GroupBy(e => e.Category)
                    .Select(g => new ExpenseReportByCategoryDto
                    {
                        Category = g.Key,
                        TotalAmount = g.Sum(e => e.Amount),
                        Count = g.Count(),
                        Percentage = totalAmount > 0 ? (g.Sum(e => e.Amount) / totalAmount) * 100 : 0
                    })
                    .OrderByDescending(c => c.TotalAmount)
                    .ToList();

                // Vendor breakdown
                var byVendor = expenses
                    .Where(e => e.VendorId.HasValue || !string.IsNullOrWhiteSpace(e.VendorName))
                    .GroupBy(e => new { e.VendorId, VendorName = e.VendorName ?? e.Vendor ?? "Unknown Vendor" })
                    .Select(g => new ExpenseReportByVendorDto
                    {
                        VendorId = g.Key.VendorId,
                        VendorName = g.Key.VendorName,
                        TotalAmount = g.Sum(e => e.Amount),
                        Count = g.Count(),
                        Percentage = totalAmount > 0 ? (g.Sum(e => e.Amount) / totalAmount) * 100 : 0
                    })
                    .OrderByDescending(v => v.TotalAmount)
                    .ToList();

                var summary = new ExpenseReportSummaryDto
                {
                    TotalAmount = totalAmount,
                    TotalCount = totalCount,
                    AverageAmount = averageAmount,
                    MinAmount = minAmount,
                    MaxAmount = maxAmount,
                    StartDate = startDate ?? expenses.Min(e => e.ExpenseDate),
                    EndDate = endDate ?? expenses.Max(e => e.ExpenseDate),
                    ByCategory = byCategory,
                    ByVendor = byVendor
                };

                return new ServiceResponse<ExpenseReportSummaryDto> { Data = summary };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expense report summary");
                return ServiceResponse<ExpenseReportSummaryDto>.CreateError("Error retrieving expense report summary", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<ExpenseTrendDto>>> GetExpenseTrends(
            long organizationId,
            long? propertyId = null,
            DateTime? startDate = null,
            DateTime? endDate = null,
            string groupBy = "month")
        {
            try
            {
                var expenses = await _expenseRepository.GetExpensesByOrganizationId(
                    organizationId, propertyId, startDate, endDate, null);

                if (!expenses.Any())
                {
                    return new ServiceResponse<List<ExpenseTrendDto>> { Data = new List<ExpenseTrendDto>() };
                }

                var actualStartDate = startDate ?? expenses.Min(e => e.ExpenseDate);
                var actualEndDate = endDate ?? expenses.Max(e => e.ExpenseDate);

                List<ExpenseTrendDto> trends;

                switch (groupBy.ToLower())
                {
                    case "week":
                        trends = expenses
                            .GroupBy(e => new { Year = e.ExpenseDate.Year, Week = GetWeekOfYear(e.ExpenseDate) })
                            .Select(g => new ExpenseTrendDto
                            {
                                Period = g.Min(e => e.ExpenseDate),
                                PeriodLabel = $"Week {g.Key.Week}, {g.Key.Year}",
                                TotalAmount = g.Sum(e => e.Amount),
                                Count = g.Count(),
                                ByCategory = g.GroupBy(e => e.Category)
                                    .ToDictionary(cg => cg.Key, cg => cg.Sum(e => e.Amount))
                            })
                            .OrderBy(t => t.Period)
                            .ToList();
                        break;

                    case "quarter":
                        trends = expenses
                            .GroupBy(e => new { Year = e.ExpenseDate.Year, Quarter = (e.ExpenseDate.Month - 1) / 3 + 1 })
                            .Select(g => new ExpenseTrendDto
                            {
                                Period = g.Min(e => e.ExpenseDate),
                                PeriodLabel = $"Q{g.Key.Quarter} {g.Key.Year}",
                                TotalAmount = g.Sum(e => e.Amount),
                                Count = g.Count(),
                                ByCategory = g.GroupBy(e => e.Category)
                                    .ToDictionary(cg => cg.Key, cg => cg.Sum(e => e.Amount))
                            })
                            .OrderBy(t => t.Period)
                            .ToList();
                        break;

                    case "year":
                        trends = expenses
                            .GroupBy(e => e.ExpenseDate.Year)
                            .Select(g => new ExpenseTrendDto
                            {
                                Period = new DateTime(g.Key, 1, 1),
                                PeriodLabel = g.Key.ToString(),
                                TotalAmount = g.Sum(e => e.Amount),
                                Count = g.Count(),
                                ByCategory = g.GroupBy(e => e.Category)
                                    .ToDictionary(cg => cg.Key, cg => cg.Sum(e => e.Amount))
                            })
                            .OrderBy(t => t.Period)
                            .ToList();
                        break;

                    default: // month
                        trends = expenses
                            .GroupBy(e => new { Year = e.ExpenseDate.Year, Month = e.ExpenseDate.Month })
                            .Select(g => new ExpenseTrendDto
                            {
                                Period = new DateTime(g.Key.Year, g.Key.Month, 1),
                                PeriodLabel = new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM yyyy"),
                                TotalAmount = g.Sum(e => e.Amount),
                                Count = g.Count(),
                                ByCategory = g.GroupBy(e => e.Category)
                                    .ToDictionary(cg => cg.Key, cg => cg.Sum(e => e.Amount))
                            })
                            .OrderBy(t => t.Period)
                            .ToList();
                        break;
                }

                return new ServiceResponse<List<ExpenseTrendDto>> { Data = trends };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expense trends");
                return ServiceResponse<List<ExpenseTrendDto>>.CreateError("Error retrieving expense trends", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<ExpenseReportByCategoryDto>>> GetExpenseReportByCategory(
            long organizationId,
            long? propertyId = null,
            long? unitId = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            try
            {
                var expenses = await _expenseRepository.GetExpensesByOrganizationId(
                    organizationId, propertyId, startDate, endDate, null);

                if (unitId.HasValue)
                {
                    expenses = expenses.Where(e => e.UnitId == unitId.Value).ToList();
                }

                var totalAmount = expenses.Sum(e => e.Amount);

                var byCategory = expenses
                    .GroupBy(e => e.Category)
                    .Select(g => new ExpenseReportByCategoryDto
                    {
                        Category = g.Key,
                        TotalAmount = g.Sum(e => e.Amount),
                        Count = g.Count(),
                        Percentage = totalAmount > 0 ? (g.Sum(e => e.Amount) / totalAmount) * 100 : 0
                    })
                    .OrderByDescending(c => c.TotalAmount)
                    .ToList();

                return new ServiceResponse<List<ExpenseReportByCategoryDto>> { Data = byCategory };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expense report by category");
                return ServiceResponse<List<ExpenseReportByCategoryDto>>.CreateError("Error retrieving expense report by category", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<PropertyProfitabilityDto>>> GetPropertyProfitability(
            long organizationId,
            long? propertyId = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            try
            {
                var properties = await _propertyRepository.GetPropertiesByOrganizationId(organizationId);

                var profitability = new List<PropertyProfitabilityDto>();

                // Filter by property if specified
                if (propertyId.HasValue)
                {
                    properties = properties.Where(p => p.Id == propertyId.Value).ToList();
                }

                foreach (var property in properties)
                {
                    // Get expenses for this property
                    var expenses = await _expenseRepository.GetExpensesByOrganizationId(
                        organizationId, property.Id, startDate, endDate, null);
                    var totalExpenses = expenses.Sum(e => e.Amount);

                    // Get rent payments for this property
                    List<LoadPaymentDto> payments;
                    if (startDate.HasValue && endDate.HasValue)
                    {
                        payments = await _paymentRepository.GetPaymentsByPropertyId(property.Id, startDate.Value, endDate.Value);
                    }
                    else
                    {
                        payments = await _paymentRepository.GetLifetimePaymentsByPropertyId(property.Id);
                        // If date range is specified, filter payments
                        if (startDate.HasValue || endDate.HasValue)
                        {
                            if (startDate.HasValue)
                                payments = payments.Where(p => p.PaymentDate >= startDate.Value).ToList();
                            if (endDate.HasValue)
                                payments = payments.Where(p => p.PaymentDate <= endDate.Value).ToList();
                        }
                    }
                    var totalRent = payments.Sum(p => p.Amount);

                    var netIncome = totalRent - totalExpenses;
                    var profitMargin = totalRent > 0 ? (netIncome / totalRent) * 100 : 0;

                    profitability.Add(new PropertyProfitabilityDto
                    {
                        PropertyId = property.Id,
                        PropertyName = property.Name,
                        TotalRent = totalRent,
                        TotalExpenses = totalExpenses,
                        NetIncome = netIncome,
                        ProfitMargin = profitMargin,
                        StartDate = startDate,
                        EndDate = endDate
                    });
                }

                return new ServiceResponse<List<PropertyProfitabilityDto>> { Data = profitability.OrderByDescending(p => p.NetIncome).ToList() };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving property profitability for organization ID {OrganizationId}", organizationId);
                return ServiceResponse<List<PropertyProfitabilityDto>>.CreateError(
                    "Error retrieving property profitability", 
                    $"Error retrieving properties for organization ID {organizationId}", 
                    ex.InnerException?.Message ?? ex.Message);
            }
        }

        public async Task<ServiceResponse<List<YearOverYearComparisonDto>>> GetYearOverYearComparison(
            long organizationId,
            long? propertyId = null,
            int? year1 = null,
            int? year2 = null)
        {
            try
            {
                var currentYear = DateTime.Now.Year;
                var year1Value = year1 ?? currentYear - 1;
                var year2Value = year2 ?? currentYear;

                var startDate1 = new DateTime(year1Value, 1, 1);
                var endDate1 = new DateTime(year1Value, 12, 31, 23, 59, 59);
                var startDate2 = new DateTime(year2Value, 1, 1);
                var endDate2 = new DateTime(year2Value, 12, 31, 23, 59, 59);

                var expenses1 = await _expenseRepository.GetExpensesByOrganizationId(
                    organizationId, propertyId, startDate1, endDate1, null);
                var expenses2 = await _expenseRepository.GetExpensesByOrganizationId(
                    organizationId, propertyId, startDate2, endDate2, null);

                var comparison = new List<YearOverYearComparisonDto>();

                // Year 1 data
                var total1 = expenses1.Sum(e => e.Amount);
                var byCategory1 = expenses1
                    .GroupBy(e => e.Category)
                    .Select(g => new ExpenseReportByCategoryDto
                    {
                        Category = g.Key,
                        TotalAmount = g.Sum(e => e.Amount),
                        Count = g.Count(),
                        Percentage = total1 > 0 ? (g.Sum(e => e.Amount) / total1) * 100 : 0
                    })
                    .ToList();

                var monthly1 = expenses1
                    .GroupBy(e => e.ExpenseDate.Month)
                    .ToDictionary(g => new DateTime(year1Value, g.Key, 1).ToString("MMM"), g => g.Sum(e => e.Amount));

                comparison.Add(new YearOverYearComparisonDto
                {
                    Year = year1Value,
                    TotalAmount = total1,
                    Count = expenses1.Count,
                    AverageAmount = expenses1.Any() ? total1 / expenses1.Count : 0,
                    ByCategory = byCategory1,
                    MonthlyBreakdown = monthly1
                });

                // Year 2 data
                var total2 = expenses2.Sum(e => e.Amount);
                var byCategory2 = expenses2
                    .GroupBy(e => e.Category)
                    .Select(g => new ExpenseReportByCategoryDto
                    {
                        Category = g.Key,
                        TotalAmount = g.Sum(e => e.Amount),
                        Count = g.Count(),
                        Percentage = total2 > 0 ? (g.Sum(e => e.Amount) / total2) * 100 : 0
                    })
                    .ToList();

                var monthly2 = expenses2
                    .GroupBy(e => e.ExpenseDate.Month)
                    .ToDictionary(g => new DateTime(year2Value, g.Key, 1).ToString("MMM"), g => g.Sum(e => e.Amount));

                comparison.Add(new YearOverYearComparisonDto
                {
                    Year = year2Value,
                    TotalAmount = total2,
                    Count = expenses2.Count,
                    AverageAmount = expenses2.Any() ? total2 / expenses2.Count : 0,
                    ByCategory = byCategory2,
                    MonthlyBreakdown = monthly2
                });

                return new ServiceResponse<List<YearOverYearComparisonDto>> { Data = comparison };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving year-over-year comparison");
                return ServiceResponse<List<YearOverYearComparisonDto>>.CreateError("Error retrieving year-over-year comparison", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<YearOverYearComparisonDto>>> GetIncomeByYear(
            long organizationId,
            long? propertyId = null,
            int? year1 = null,
            int? year2 = null)
        {
            try
            {
                var currentYear = DateTime.Now.Year;
                var year1Value = year1 ?? currentYear - 1;
                var year2Value = year2 ?? currentYear;

                var startDate1 = new DateTime(year1Value, 1, 1);
                var endDate1 = new DateTime(year1Value, 12, 31, 23, 59, 59);
                var startDate2 = new DateTime(year2Value, 1, 1);
                var endDate2 = new DateTime(year2Value, 12, 31, 23, 59, 59);

                // Get payments for year 1
                List<LoadPaymentDto> payments1;
                if (propertyId.HasValue)
                {
                    payments1 = await _paymentRepository.GetPaymentsByPropertyId(propertyId.Value, startDate1, endDate1);
                }
                else
                {
                    var allPayments1 = await _paymentRepository.GetLifetimePaymentsByOrganizationId(organizationId);
                    payments1 = allPayments1.Where(p => p.PaymentDate >= startDate1 && p.PaymentDate <= endDate1).ToList();
                }

                // Get payments for year 2
                List<LoadPaymentDto> payments2;
                if (propertyId.HasValue)
                {
                    payments2 = await _paymentRepository.GetPaymentsByPropertyId(propertyId.Value, startDate2, endDate2);
                }
                else
                {
                    var allPayments2 = await _paymentRepository.GetLifetimePaymentsByOrganizationId(organizationId);
                    payments2 = allPayments2.Where(p => p.PaymentDate >= startDate2 && p.PaymentDate <= endDate2).ToList();
                }

                var comparison = new List<YearOverYearComparisonDto>();

                // Year 1 data
                var total1 = payments1.Sum(p => p.Amount);
                var monthly1 = payments1
                    .GroupBy(p => p.PaymentDate.Month)
                    .ToDictionary(g => new DateTime(year1Value, g.Key, 1).ToString("MMM"), g => g.Sum(p => p.Amount));

                comparison.Add(new YearOverYearComparisonDto
                {
                    Year = year1Value,
                    TotalAmount = total1,
                    Count = payments1.Count,
                    AverageAmount = payments1.Any() ? total1 / payments1.Count : 0,
                    ByCategory = null,
                    MonthlyBreakdown = monthly1
                });

                // Year 2 data
                var total2 = payments2.Sum(p => p.Amount);
                var monthly2 = payments2
                    .GroupBy(p => p.PaymentDate.Month)
                    .ToDictionary(g => new DateTime(year2Value, g.Key, 1).ToString("MMM"), g => g.Sum(p => p.Amount));

                comparison.Add(new YearOverYearComparisonDto
                {
                    Year = year2Value,
                    TotalAmount = total2,
                    Count = payments2.Count,
                    AverageAmount = payments2.Any() ? total2 / payments2.Count : 0,
                    ByCategory = null,
                    MonthlyBreakdown = monthly2
                });

                return new ServiceResponse<List<YearOverYearComparisonDto>> { Data = comparison };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving income by year");
                return ServiceResponse<List<YearOverYearComparisonDto>>.CreateError("Error retrieving income by year", ex.Message);
            }
        }

        private static int GetWeekOfYear(DateTime date)
        {
            var dayOfYear = date.DayOfYear;
            var firstDayOfYear = new DateTime(date.Year, 1, 1);
            var daysOffset = (int)firstDayOfYear.DayOfWeek;
            var weekNumber = (dayOfYear + daysOffset) / 7;
            return weekNumber;
        }
    }
}

