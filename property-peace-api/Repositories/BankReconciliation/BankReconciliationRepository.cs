using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace brownstone_hub_api.Repositories.BankReconciliation
{
    public class BankReconciliationRepository : IBankReconciliationRepository
    {
        private readonly DataContext _context;

        public BankReconciliationRepository(DataContext context) => _context = context;

        public Task<bool> BankAccountBelongsToOrganizationAsync(long organizationId, long bankAccountId) =>
            _context.BankAccounts.AnyAsync(a => a.Id == bankAccountId && a.OrganizationId == organizationId);

        public async Task<BankStatement> AddBankStatementWithTransactionsAsync(
            BankStatement statement,
            IReadOnlyCollection<BankStatementTransaction> transactions)
        {
            var now = DateTime.UtcNow;
            statement.CreatedAt = now;
            _context.BankStatements.Add(statement);
            foreach (var transaction in transactions)
            {
                transaction.BankStatement = statement;
                transaction.CreatedAt = now;
                _context.BankStatementTransactions.Add(transaction);
            }

            // One SaveChanges call is one database transaction: no orphan/partial statement upload.
            await _context.SaveChangesAsync();
            return statement;
        }

        public Task<BankStatement?> GetBankStatementByIdAsync(long organizationId, long id) =>
            _context.BankStatements
                .Include(s => s.BankAccount)
                .FirstOrDefaultAsync(s => s.Id == id && s.OrganizationId == organizationId);

        public Task<List<BankStatement>> GetBankStatementsByOrganizationIdAsync(long organizationId) =>
            _context.BankStatements
                .Include(s => s.BankAccount)
                .Where(s => s.OrganizationId == organizationId)
                .OrderByDescending(s => s.StatementDate)
                .ToListAsync();

        public Task<BankStatementTransaction?> GetTransactionByIdAsync(long organizationId, long id) =>
            Transactions(organizationId).FirstOrDefaultAsync(t => t.Id == id);

        public Task<List<BankStatementTransaction>> GetTransactionsByStatementIdAsync(long organizationId, long bankStatementId) =>
            Transactions(organizationId)
                .Where(t => t.BankStatementId == bankStatementId)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.CreatedAt)
                .ToListAsync();

        public async Task<List<BankStatementTransaction>> GetUnmatchedTransactionsAsync(long organizationId, long? bankStatementId = null)
        {
            var query = Transactions(organizationId).Where(t => !t.IsMatched && !t.IsReconciled);
            if (bankStatementId.HasValue)
                query = query.Where(t => t.BankStatementId == bankStatementId.Value);
            return await query.OrderBy(t => t.TransactionDate).ToListAsync();
        }

        public async Task<List<BankStatementTransaction>> GetAllTransactionsAsync(long organizationId, long? bankStatementId = null)
        {
            var query = Transactions(organizationId);
            if (bankStatementId.HasValue)
                query = query.Where(t => t.BankStatementId == bankStatementId.Value);
            return await query.OrderBy(t => t.TransactionDate).ToListAsync();
        }

        public async Task<bool> TryMatchTransactionAsync(long organizationId, long transactionId, long ledgerEntryId)
        {
            await using var dbTransaction = _context.Database.IsRelational()
                ? await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable)
                : null;
            var transaction = await _context.BankStatementTransactions
                .Include(t => t.BankStatement)
                .FirstOrDefaultAsync(t => t.Id == transactionId && t.BankStatement.OrganizationId == organizationId);
            if (transaction == null || transaction.IsReconciled || await IsStatementReconciledAsync(transaction.BankStatementId))
                return false;

            var ledgerBelongsToOrganization = await _context.GeneralLedgerEntries
                .AnyAsync(e => e.Id == ledgerEntryId && e.OrganizationId == organizationId);
            if (!ledgerBelongsToOrganization)
                return false;

            // The data model has no split allocation, so a ledger row is one-to-one with a bank row.
            var alreadyUsed = await _context.BankStatementTransactions.AnyAsync(t =>
                t.Id != transactionId && t.IsMatched && t.MatchedLedgerEntryId == ledgerEntryId);
            if (alreadyUsed)
                return false;

            transaction.IsMatched = true;
            transaction.MatchedLedgerEntryId = ledgerEntryId;
            transaction.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            if (dbTransaction != null)
                await dbTransaction.CommitAsync();
            return true;
        }

        public async Task<bool> TryUnmatchTransactionAsync(long organizationId, long transactionId)
        {
            var transaction = await _context.BankStatementTransactions
                .Include(t => t.BankStatement)
                .FirstOrDefaultAsync(t => t.Id == transactionId && t.BankStatement.OrganizationId == organizationId);
            if (transaction == null || transaction.IsReconciled || await IsStatementReconciledAsync(transaction.BankStatementId))
                return false;

            transaction.IsMatched = false;
            transaction.MatchedLedgerEntryId = null;
            transaction.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteTransactionAsync(long organizationId, long transactionId)
        {
            var transaction = await _context.BankStatementTransactions
                .Include(t => t.BankStatement)
                .FirstOrDefaultAsync(t => t.Id == transactionId && t.BankStatement.OrganizationId == organizationId);
            if (transaction == null || transaction.IsReconciled || await IsStatementReconciledAsync(transaction.BankStatementId))
                return false;

            _context.BankStatementTransactions.Remove(transaction);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<int> DeleteAllUnmatchedTransactionsAsync(long organizationId)
        {
            var transactions = await _context.BankStatementTransactions
                .Include(t => t.BankStatement)
                .Where(t => t.BankStatement.OrganizationId == organizationId &&
                            !t.IsMatched &&
                            !t.IsReconciled &&
                            !_context.BankReconciliations.Any(r =>
                                r.BankStatementId == t.BankStatementId && r.Status == "Reconciled"))
                .ToListAsync();
            if (transactions.Count != 0)
            {
                _context.BankStatementTransactions.RemoveRange(transactions);
                await _context.SaveChangesAsync();
            }
            return transactions.Count;
        }

        public Task<Models.BankReconciliation?> GetReconciliationByStatementIdAsync(long organizationId, long bankStatementId) =>
            _context.BankReconciliations
                .Include(r => r.BankStatement)
                .Include(r => r.ReconciledByUser)
                .FirstOrDefaultAsync(r => r.BankStatementId == bankStatementId && r.BankStatement.OrganizationId == organizationId);

        public async Task<bool> TryReconcileStatementAsync(
            long organizationId,
            long bankStatementId,
            long userId,
            string? notes)
        {
            await using var dbTransaction = _context.Database.IsRelational()
                ? await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable)
                : null;
            var statement = await _context.BankStatements
                .FirstOrDefaultAsync(s => s.Id == bankStatementId && s.OrganizationId == organizationId);
            if (statement == null || !statement.StartingBalance.HasValue || !statement.EndingBalance.HasValue)
                return false;

            var transactions = await _context.BankStatementTransactions
                .Where(t => t.BankStatementId == bankStatementId)
                .ToListAsync();
            if (transactions.Count == 0 || transactions.Any(t => !t.IsMatched || !t.MatchedLedgerEntryId.HasValue))
                return false;

            var difference = statement.StartingBalance.Value + transactions.Sum(t => t.Amount) - statement.EndingBalance.Value;
            if (difference != 0m)
                return false;

            var alreadyReconciled = await _context.BankReconciliations
                .AnyAsync(r => r.BankStatementId == bankStatementId && r.Status == "Reconciled");
            if (alreadyReconciled)
                return false;

            var now = DateTime.UtcNow;
            _context.BankReconciliations.Add(new Models.BankReconciliation
            {
                BankStatementId = bankStatementId,
                ReconciledDate = now,
                ReconciledByUserId = userId,
                Status = "Reconciled",
                Notes = notes,
                CreatedAt = now
            });
            foreach (var transaction in transactions)
            {
                transaction.IsReconciled = true;
                transaction.UpdatedAt = now;
            }

            // Reconciliation evidence and row locks become durable together.
            await _context.SaveChangesAsync();
            if (dbTransaction != null)
                await dbTransaction.CommitAsync();
            return true;
        }

        private IQueryable<BankStatementTransaction> Transactions(long organizationId) =>
            _context.BankStatementTransactions
                .Include(t => t.BankStatement)
                .Include(t => t.MatchedLedgerEntry)
                    .ThenInclude(e => e.Account)
                .Where(t => t.BankStatement.OrganizationId == organizationId);

        private Task<bool> IsStatementReconciledAsync(long bankStatementId) =>
            _context.BankReconciliations.AnyAsync(r =>
                r.BankStatementId == bankStatementId && r.Status == "Reconciled");
    }
}
