using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.GeneralLedger;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.GeneralLedger
{
    public class GeneralLedgerRepository : IGeneralLedgerRepository
    {
        private readonly DataContext _context;

        public GeneralLedgerRepository(DataContext context)
        {
            _context = context;
        }

        public async Task<GeneralLedgerEntry> AddEntryAsync(GeneralLedgerEntry entry)
        {
            entry.CreatedAt = DateTime.Now;
            _context.GeneralLedgerEntries.Add(entry);
            await _context.SaveChangesAsync();
            return entry;
        }

        public async Task<List<GeneralLedgerEntry>> GetEntriesByAccountAsync(long organizationId, long accountId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var query = _context.GeneralLedgerEntries
                .Where(e => e.OrganizationId == organizationId && e.AccountId == accountId);

            if (startDate.HasValue)
            {
                query = query.Where(e => e.TransactionDate >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(e => e.TransactionDate <= endDate.Value);
            }

            return await query
                .Include(e => e.Account)
                .OrderBy(e => e.TransactionDate)
                .ThenBy(e => e.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<GeneralLedgerEntry>> GetEntriesByDateRangeAsync(long organizationId, DateTime startDate, DateTime endDate)
        {
            return await _context.GeneralLedgerEntries
                .Where(e => e.OrganizationId == organizationId && e.TransactionDate >= startDate && e.TransactionDate <= endDate)
                .Include(e => e.Account)
                .OrderBy(e => e.TransactionDate)
                .ThenBy(e => e.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<GeneralLedgerEntry>> GetEntriesByOrganizationAsync(long organizationId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var query = _context.GeneralLedgerEntries
                .Where(e => e.OrganizationId == organizationId);

            if (startDate.HasValue)
            {
                query = query.Where(e => e.TransactionDate >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(e => e.TransactionDate <= endDate.Value);
            }

            return await query
                .Include(e => e.Account)
                .OrderBy(e => e.TransactionDate)
                .ThenBy(e => e.CreatedAt)
                .ToListAsync();
        }

        public async Task<decimal> GetAccountBalanceAsync(long organizationId, long accountId, DateTime? asOfDate = null)
        {
            var query = _context.GeneralLedgerEntries
                .Where(e => e.OrganizationId == organizationId && e.AccountId == accountId);

            if (asOfDate.HasValue)
            {
                query = query.Where(e => e.TransactionDate <= asOfDate.Value);
            }

            return await query.SumAsync(e => e.Amount);
        }

        public async Task<List<AccountBalanceDto>> GetAccountBalancesAsync(long organizationId, DateTime? asOfDate = null)
        {
            var query = _context.GeneralLedgerEntries
                .Where(e => e.OrganizationId == organizationId);

            if (asOfDate.HasValue)
            {
                query = query.Where(e => e.TransactionDate <= asOfDate.Value);
            }

            var balances = await query
                .Include(e => e.Account)
                .GroupBy(e => new { e.AccountId, e.Account.AccountCode, e.Account.AccountName })
                .Select(g => new AccountBalanceDto
                {
                    AccountId = g.Key.AccountId,
                    AccountCode = g.Key.AccountCode,
                    AccountName = g.Key.AccountName,
                    Balance = g.Sum(e => e.Amount),
                    LastTransactionDate = g.Max(e => e.TransactionDate)
                })
                .ToListAsync();

            return balances;
        }
    }
}
