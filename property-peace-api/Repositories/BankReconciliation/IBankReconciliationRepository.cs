using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.BankReconciliation
{
    public interface IBankReconciliationRepository
    {
        Task<bool> BankAccountBelongsToOrganizationAsync(long organizationId, long bankAccountId);
        Task<BankStatement> AddBankStatementWithTransactionsAsync(BankStatement statement, IReadOnlyCollection<BankStatementTransaction> transactions);
        Task<BankStatement?> GetBankStatementByIdAsync(long organizationId, long id);
        Task<List<BankStatement>> GetBankStatementsByOrganizationIdAsync(long organizationId);
        Task<BankStatementTransaction?> GetTransactionByIdAsync(long organizationId, long id);
        Task<List<BankStatementTransaction>> GetTransactionsByStatementIdAsync(long organizationId, long bankStatementId);
        Task<List<BankStatementTransaction>> GetUnmatchedTransactionsAsync(long organizationId, long? bankStatementId = null);
        Task<List<BankStatementTransaction>> GetAllTransactionsAsync(long organizationId, long? bankStatementId = null);
        Task<bool> TryMatchTransactionAsync(long organizationId, long transactionId, long ledgerEntryId);
        Task<bool> TryUnmatchTransactionAsync(long organizationId, long transactionId);
        Task<bool> DeleteTransactionAsync(long organizationId, long transactionId);
        Task<int> DeleteAllUnmatchedTransactionsAsync(long organizationId);
        Task<Models.BankReconciliation?> GetReconciliationByStatementIdAsync(long organizationId, long bankStatementId);
        Task<bool> TryReconcileStatementAsync(long organizationId, long bankStatementId, long userId, string? notes);
    }
}
