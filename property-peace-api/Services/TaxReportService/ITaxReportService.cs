using brownstone_hub_api.Dtos.Tax;

namespace brownstone_hub_api.Services.TaxReportService
{
    public interface ITaxReportService
    {
        Task<ServiceResponse<TaxYearReportDto>> GetTaxYearReport(long landlordId, int year);
        Task<ServiceResponse<List<TaxCategorySummaryDto>>> GetTaxCategorySummary(long landlordId, int? year = null);
        Task<ServiceResponse<List<TaxDeductibleExpenseDto>>> GetTaxDeductibleExpenses(long landlordId, int? year = null, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<List<Form1099Dto>>> GetForm1099Data(long landlordId, int year);
        Task<ServiceResponse<TaxReadinessDto>> GetTaxReadiness(long landlordId, int year);
        Task<ServiceResponse<AccountingExportDto>> ExportToAccountingSoftware(long landlordId, string format, int? year = null, DateTime? startDate = null, DateTime? endDate = null);
    }
}

