using brownstone_hub_api.Dtos.ExpenseReport;

namespace brownstone_hub_api.Services.ExpenseReportService
{
    public interface IExpenseReportService
    {
        Task<ServiceResponse<List<ExpenseReportDto>>> GetExpenseReport(long organizationId, long? propertyId = null, long? unitId = null, DateTime? startDate = null, DateTime? endDate = null, string? category = null, long? vendorId = null);
        Task<ServiceResponse<ExpenseReportSummaryDto>> GetExpenseReportSummary(long organizationId, long? propertyId = null, long? unitId = null, DateTime? startDate = null, DateTime? endDate = null, string? category = null, long? vendorId = null);
        Task<ServiceResponse<List<ExpenseTrendDto>>> GetExpenseTrends(long organizationId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null, string groupBy = "month");
        Task<ServiceResponse<List<ExpenseReportByCategoryDto>>> GetExpenseReportByCategory(long organizationId, long? propertyId = null, long? unitId = null, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<List<PropertyProfitabilityDto>>> GetPropertyProfitability(long organizationId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<List<YearOverYearComparisonDto>>> GetYearOverYearComparison(long organizationId, long? propertyId = null, int? year1 = null, int? year2 = null);
        Task<ServiceResponse<List<YearOverYearComparisonDto>>> GetIncomeByYear(long organizationId, long? propertyId = null, int? year1 = null, int? year2 = null);
    }
}

