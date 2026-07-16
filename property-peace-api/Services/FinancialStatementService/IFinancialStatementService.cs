using brownstone_hub_api.Dtos.FinancialStatements;

namespace brownstone_hub_api.Services.FinancialStatementService
{
    public interface IFinancialStatementService
    {
        Task<ServiceResponse<ProfitAndLossDto>> GetProfitAndLossAsync(long organizationId, DateTime startDate, DateTime endDate);
        Task<ServiceResponse<BalanceSheetDto>> GetBalanceSheetAsync(long organizationId, DateTime asOfDate);
        Task<ServiceResponse<CashFlowDto>> GetCashFlowAsync(long organizationId, DateTime startDate, DateTime endDate);
    }
}
