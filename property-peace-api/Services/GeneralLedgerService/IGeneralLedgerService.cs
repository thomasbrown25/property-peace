using brownstone_hub_api.Dtos.GeneralLedger;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Services.GeneralLedgerService
{
    public interface IGeneralLedgerService
    {
        Task<ServiceResponse<LoadGeneralLedgerEntryDto>> CreateLedgerEntryAsync(long organizationId, long accountId, long? transactionId, string transactionType, decimal amount, DateTime transactionDate, string? description = null, string? reference = null);
        Task<ServiceResponse<List<LoadGeneralLedgerEntryDto>>> GetEntriesByAccountAsync(long organizationId, long accountId, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<List<LoadGeneralLedgerEntryDto>>> GetEntriesByDateRangeAsync(long organizationId, DateTime startDate, DateTime endDate);
        Task<ServiceResponse<decimal>> GetAccountBalanceAsync(long organizationId, long accountId, DateTime? asOfDate = null);
        Task<ServiceResponse<List<AccountBalanceDto>>> GetAccountBalancesAsync(long organizationId, DateTime? asOfDate = null);
    }
}
