using brownstone_hub_api.Dtos.GeneralLedger;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.GeneralLedger
{
    public interface IGeneralLedgerRepository
    {
        Task<GeneralLedgerEntry> AddEntryAsync(GeneralLedgerEntry entry);
        Task<List<GeneralLedgerEntry>> GetEntriesByAccountAsync(long organizationId, long accountId, DateTime? startDate = null, DateTime? endDate = null);
        Task<List<GeneralLedgerEntry>> GetEntriesByDateRangeAsync(long organizationId, DateTime startDate, DateTime endDate);
        Task<List<GeneralLedgerEntry>> GetEntriesByOrganizationAsync(long organizationId, DateTime? startDate = null, DateTime? endDate = null);
        Task<decimal> GetAccountBalanceAsync(long organizationId, long accountId, DateTime? asOfDate = null);
        Task<List<AccountBalanceDto>> GetAccountBalancesAsync(long organizationId, DateTime? asOfDate = null);
    }
}
