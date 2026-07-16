using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.BankReconciliation
{
    public interface IBankReconciliationRepository
    {
        Task<BankStatement> AddBankStatementAsync(BankStatement statement);
        Task<BankStatement?> GetBankStatementByIdAsync(long id);
        Task<List<BankStatement>> GetBankStatementsByOrganizationIdAsync(long organizationId);
        Task<BankStatementTransaction> AddTransactionAsync(BankStatementTransaction transaction);
        Task<BankStatementTransaction?> GetTransactionByIdAsync(long id);
        Task<List<BankStatementTransaction>> GetTransactionsByStatementIdAsync(long bankStatementId);
        Task<List<BankStatementTransaction>> GetUnmatchedTransactionsAsync(long organizationId, long? bankStatementId = null);
        Task<List<BankStatementTransaction>> GetAllTransactionsAsync(long organizationId, long? bankStatementId = null);
        Task UpdateTransactionMatchAsync(long transactionId, long? ledgerEntryId, bool isMatched);
        Task MarkMatchedTransactionsAsReconciledAsync(long bankStatementId);
        Task<bool> DeleteTransactionAsync(long transactionId);
        Task<int> DeleteAllUnmatchedTransactionsAsync(long organizationId);
        Task<Models.BankReconciliation> AddReconciliationAsync(Models.BankReconciliation reconciliation);
        Task<Models.BankReconciliation?> GetReconciliationByStatementIdAsync(long bankStatementId);
        Task UpdateReconciliationStatusAsync(long reconciliationId, string status);
    }
}
