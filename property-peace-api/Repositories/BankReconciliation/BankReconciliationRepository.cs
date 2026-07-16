using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.BankReconciliation
{
    public class BankReconciliationRepository : IBankReconciliationRepository
    {
        private readonly DataContext _context;

        public BankReconciliationRepository(DataContext context)
        {
            _context = context;
        }

        public async Task<BankStatement> AddBankStatementAsync(BankStatement statement)
        {
            statement.CreatedAt = DateTime.Now;
            _context.BankStatements.Add(statement);
            await _context.SaveChangesAsync();
            return statement;
        }

        public async Task<BankStatement?> GetBankStatementByIdAsync(long id)
        {
            return await _context.BankStatements
                .Include(s => s.BankAccount)
                .FirstOrDefaultAsync(s => s.Id == id);
        }

        public async Task<List<BankStatement>> GetBankStatementsByOrganizationIdAsync(long organizationId)
        {
            return await _context.BankStatements
                .Include(s => s.BankAccount)
                .Where(s => s.OrganizationId == organizationId)
                .OrderByDescending(s => s.StatementDate)
                .ToListAsync();
        }

        public async Task<BankStatementTransaction> AddTransactionAsync(BankStatementTransaction transaction)
        {
            transaction.CreatedAt = DateTime.Now;
            _context.BankStatementTransactions.Add(transaction);
            await _context.SaveChangesAsync();
            return transaction;
        }

        public async Task<BankStatementTransaction?> GetTransactionByIdAsync(long id)
        {
            return await _context.BankStatementTransactions
                .Include(t => t.MatchedLedgerEntry)
                    .ThenInclude(e => e.Account)
                .FirstOrDefaultAsync(t => t.Id == id);
        }

        public async Task<List<BankStatementTransaction>> GetTransactionsByStatementIdAsync(long bankStatementId)
        {
            return await _context.BankStatementTransactions
                .Include(t => t.MatchedLedgerEntry)
                    .ThenInclude(e => e.Account)
                .Where(t => t.BankStatementId == bankStatementId)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<BankStatementTransaction>> GetUnmatchedTransactionsAsync(long organizationId, long? bankStatementId = null)
        {
            var query = _context.BankStatementTransactions
                .Include(t => t.BankStatement)
                .Include(t => t.MatchedLedgerEntry)
                    .ThenInclude(e => e.Account)
                .Where(t => t.BankStatement.OrganizationId == organizationId && !t.IsMatched);

            if (bankStatementId.HasValue)
            {
                query = query.Where(t => t.BankStatementId == bankStatementId.Value);
            }

            return await query
                .OrderBy(t => t.TransactionDate)
                .ToListAsync();
        }

        public async Task<List<BankStatementTransaction>> GetAllTransactionsAsync(long organizationId, long? bankStatementId = null)
        {
            var query = _context.BankStatementTransactions
                .Include(t => t.BankStatement)
                .Include(t => t.MatchedLedgerEntry)
                    .ThenInclude(e => e.Account)
                .Where(t => t.BankStatement.OrganizationId == organizationId);

            if (bankStatementId.HasValue)
            {
                query = query.Where(t => t.BankStatementId == bankStatementId.Value);
            }

            return await query
                .OrderBy(t => t.TransactionDate)
                .ToListAsync();
        }

        public async Task UpdateTransactionMatchAsync(long transactionId, long? ledgerEntryId, bool isMatched)
        {
            var transaction = await _context.BankStatementTransactions.FindAsync(transactionId);
            if (transaction != null)
            {
                transaction.IsMatched = isMatched;
                transaction.MatchedLedgerEntryId = ledgerEntryId;
                transaction.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();
            }
        }

        public async Task<bool> DeleteTransactionAsync(long transactionId)
        {
            var transaction = await _context.BankStatementTransactions.FindAsync(transactionId);
            if (transaction != null)
            {
                _context.BankStatementTransactions.Remove(transaction);
                await _context.SaveChangesAsync();
                return true;
            }
            return false;
        }

        public async Task<Models.BankReconciliation> AddReconciliationAsync(Models.BankReconciliation reconciliation)
        {
            reconciliation.CreatedAt = DateTime.Now;
            _context.BankReconciliations.Add(reconciliation);
            await _context.SaveChangesAsync();
            return reconciliation;
        }

        public async Task<Models.BankReconciliation?> GetReconciliationByStatementIdAsync(long bankStatementId)
        {
            return await _context.BankReconciliations
                .Include(r => r.ReconciledByUser)
                .FirstOrDefaultAsync(r => r.BankStatementId == bankStatementId);
        }

        public async Task UpdateReconciliationStatusAsync(long reconciliationId, string status)
        {
            var reconciliation = await _context.BankReconciliations.FindAsync(reconciliationId);
            if (reconciliation != null)
            {
                reconciliation.Status = status;
                reconciliation.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();
            }
        }

        public async Task MarkMatchedTransactionsAsReconciledAsync(long bankStatementId)
        {
            var transactions = await _context.BankStatementTransactions
                .Where(t => t.BankStatementId == bankStatementId && t.IsMatched && !t.IsReconciled)
                .ToListAsync();

            foreach (var transaction in transactions)
            {
                transaction.IsReconciled = true;
                transaction.UpdatedAt = DateTime.Now;
            }

            if (transactions.Any())
            {
                await _context.SaveChangesAsync();
            }
        }

        public async Task<int> DeleteAllUnmatchedTransactionsAsync(long organizationId)
        {
            var transactions = await _context.BankStatementTransactions
                .Include(t => t.BankStatement)
                .Where(t => t.BankStatement.OrganizationId == organizationId && !t.IsMatched)
                .ToListAsync();

            var count = transactions.Count;
            if (count > 0)
            {
                _context.BankStatementTransactions.RemoveRange(transactions);
                await _context.SaveChangesAsync();
            }

            return count;
        }
    }
}
