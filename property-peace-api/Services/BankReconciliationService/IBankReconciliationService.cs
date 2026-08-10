using brownstone_hub_api.Dtos.BankReconciliation;
using brownstone_hub_api.Dtos.GeneralLedger;

namespace brownstone_hub_api.Services.BankReconciliationService
{
    public interface IBankReconciliationService
    {
        Task<ServiceResponse<LoadBankStatementDto>> UploadBankStatementAsync(long organizationId, UploadBankStatementDto statementDto);
        Task<ServiceResponse<List<LoadBankStatementTransactionDto>>> GetUnmatchedTransactionsAsync(long organizationId, long? bankStatementId = null);
        Task<ServiceResponse<List<LoadGeneralLedgerEntryDto>>> GetUnmatchedLedgerEntriesAsync(long organizationId, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<bool>> MatchTransactionAsync(long organizationId, long bankTransactionId, long ledgerEntryId);
        Task<ServiceResponse<bool>> UnmatchTransactionAsync(long organizationId, long bankTransactionId);
        Task<ServiceResponse<bool>> DeleteTransactionAsync(long organizationId, long bankTransactionId);
        Task<ServiceResponse<int>> ClearUnmatchedTransactionsAsync(long organizationId);
        Task<ServiceResponse<ReconciliationReportDto>> GetReconciliationReportAsync(long organizationId, long bankStatementId);
        Task<ServiceResponse<bool>> ReconcileStatementAsync(long organizationId, long bankStatementId, long userId, string? notes = null);
    }
}
