using brownstone_hub_api.Dtos.Tax;

namespace brownstone_hub_api.Services.TaxReportService
{
    public interface ITaxReportService
    {
        Task<ServiceResponse<TaxYearReportDto>> GetTaxYearReport(long organizationId, int year);
        Task<ServiceResponse<List<TaxCategorySummaryDto>>> GetTaxCategorySummary(long organizationId, int? year = null);
        Task<ServiceResponse<List<TaxDeductibleExpenseDto>>> GetTaxDeductibleExpenses(long organizationId, int? year = null, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<List<Form1099Dto>>> GetForm1099Data(long organizationId, int year);
        Task<ServiceResponse<TaxReadinessDto>> GetTaxReadiness(long organizationId, int year);
        Task<ServiceResponse<AccountingExportDto>> ExportToAccountingSoftware(long organizationId, string format, int? year = null, DateTime? startDate = null, DateTime? endDate = null);
    }
}

