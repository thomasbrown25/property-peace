using AutoMapper;
using brownstone_hub_api.Dtos.BankReconciliation;
using brownstone_hub_api.Dtos.GeneralLedger;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.BankReconciliation;
using brownstone_hub_api.Services.GeneralLedgerService;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Services.BankReconciliationService
{
    public class BankReconciliationService : IBankReconciliationService
    {
        private readonly IBankReconciliationRepository _repository;
        private readonly IGeneralLedgerService _generalLedgerService;
        private readonly IMapper _mapper;
        private readonly ILogger<BankReconciliationService> _logger;

        public BankReconciliationService(
            IBankReconciliationRepository repository,
            IGeneralLedgerService generalLedgerService,
            IMapper mapper,
            ILogger<BankReconciliationService> logger)
        {
            _repository = repository;
            _generalLedgerService = generalLedgerService;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<ServiceResponse<LoadBankStatementDto>> UploadBankStatementAsync(long organizationId, UploadBankStatementDto statementDto)
        {
            var response = new ServiceResponse<LoadBankStatementDto>();

            try
            {
                // Calculate statement date from transactions if not provided
                var statementDate = statementDto.StatementDate;
                if (!statementDate.HasValue && statementDto.Transactions != null && statementDto.Transactions.Any())
                {
                    statementDate = statementDto.Transactions.Max(t => t.TransactionDate);
                }
                else if (!statementDate.HasValue)
                {
                    statementDate = DateTime.UtcNow;
                }

                var statement = new BankStatement
                {
                    OrganizationId = organizationId,
                    BankAccountId = statementDto.BankAccountId,
                    StatementDate = statementDate,
                    StartingBalance = statementDto.StartingBalance ?? 0,
                    EndingBalance = statementDto.EndingBalance ?? 0
                };

                var savedStatement = await _repository.AddBankStatementAsync(statement);

                // Add transactions
                foreach (var transactionDto in statementDto.Transactions)
                {
                    var transaction = new BankStatementTransaction
                    {
                        BankStatementId = savedStatement.Id,
                        TransactionDate = transactionDto.TransactionDate,
                        Description = transactionDto.Description,
                        Amount = transactionDto.Amount,
                        Reference = transactionDto.Reference,
                        CheckNumber = transactionDto.CheckNumber,
                        IsMatched = false
                    };

                    await _repository.AddTransactionAsync(transaction);
                }

                // Try to auto-match transactions
                await AutoMatchTransactionsAsync(organizationId, savedStatement.Id);

                var dto = MapToDto(savedStatement);
                response.Data = dto;
                response.Message = "Bank statement uploaded successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading bank statement");
                response.Success = false;
                response.Message = $"Error uploading bank statement: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<List<LoadBankStatementTransactionDto>>> GetUnmatchedTransactionsAsync(long organizationId, long? bankStatementId = null)
        {
            var response = new ServiceResponse<List<LoadBankStatementTransactionDto>>();

            try
            {
                var transactions = await _repository.GetUnmatchedTransactionsAsync(organizationId, bankStatementId);
                var dtos = transactions.Select(t => MapTransactionToDto(t)).ToList();
                response.Data = dtos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unmatched transactions");
                response.Success = false;
                response.Message = $"Error getting unmatched transactions: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<List<LoadGeneralLedgerEntryDto>>> GetUnmatchedLedgerEntriesAsync(long organizationId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var response = new ServiceResponse<List<LoadGeneralLedgerEntryDto>>();

            try
            {
                // Get all ledger entries in the date range
                if (!startDate.HasValue || !endDate.HasValue)
                {
                    startDate = DateTime.Today.AddMonths(-3);
                    endDate = DateTime.Today;
                }

                var entriesResponse = await _generalLedgerService.GetEntriesByDateRangeAsync(organizationId, startDate.Value, endDate.Value);
                if (!entriesResponse.Success || entriesResponse.Data == null)
                {
                    response.Success = false;
                    response.Message = "Failed to retrieve ledger entries";
                    return response;
                }

                // Get all matched ledger entry IDs from transactions that are NOT reconciled
                // Only exclude entries that are matched to non-reconciled transactions
                var allTransactions = await _repository.GetAllTransactionsAsync(organizationId, null);
                var matchedIds = allTransactions
                    .Where(t => t.IsMatched && t.MatchedLedgerEntryId.HasValue && !t.IsReconciled)
                    .Select(t => t.MatchedLedgerEntryId!.Value)
                    .ToHashSet();

                // Filter out matched entries (only those that are matched to non-reconciled transactions)
                var unmatchedEntries = entriesResponse.Data
                    .Where(e => !matchedIds.Contains(e.Id))
                    .ToList();

                response.Data = unmatchedEntries;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unmatched ledger entries");
                response.Success = false;
                response.Message = $"Error getting unmatched ledger entries: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> MatchTransactionAsync(long bankTransactionId, long ledgerEntryId)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                await _repository.UpdateTransactionMatchAsync(bankTransactionId, ledgerEntryId, true);
                response.Data = true;
                response.Message = "Transaction matched successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error matching transaction");
                response.Success = false;
                response.Message = $"Error matching transaction: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> UnmatchTransactionAsync(long bankTransactionId)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                await _repository.UpdateTransactionMatchAsync(bankTransactionId, null, false);
                response.Data = true;
                response.Message = "Transaction unmatched successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unmatching transaction");
                response.Success = false;
                response.Message = $"Error unmatching transaction: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> DeleteTransactionAsync(long bankTransactionId)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                var deleted = await _repository.DeleteTransactionAsync(bankTransactionId);
                if (deleted)
                {
                    response.Data = true;
                    response.Message = "Transaction deleted successfully";
                }
                else
                {
                    response.Success = false;
                    response.Message = "Transaction not found";
                    response.StatusCode = 404;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting transaction");
                response.Success = false;
                response.Message = $"Error deleting transaction: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<int>> ClearUnmatchedTransactionsAsync(long organizationId)
        {
            var response = new ServiceResponse<int>();
            try
            {
                var count = await _repository.DeleteAllUnmatchedTransactionsAsync(organizationId);
                response.Data = count;
                response.Message = $"Successfully deleted {count} unmatched transaction(s)";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing unmatched transactions for organization {OrganizationId}", organizationId);
                response.Success = false;
                response.Message = $"Error clearing unmatched transactions: {ex.Message}";
            }
            return response;
        }

        public async Task<ServiceResponse<ReconciliationReportDto>> GetReconciliationReportAsync(long bankStatementId)
        {
            var response = new ServiceResponse<ReconciliationReportDto>();

            try
            {
                var statement = await _repository.GetBankStatementByIdAsync(bankStatementId);
                if (statement == null)
                {
                    response.Success = false;
                    response.Message = "Bank statement not found";
                    response.StatusCode = 404;
                    return response;
                }

                var transactions = await _repository.GetTransactionsByStatementIdAsync(bankStatementId);
                var transactionDtos = transactions.Select(t => MapTransactionToDto(t)).ToList();

                var reconciliation = await _repository.GetReconciliationByStatementIdAsync(bankStatementId);

                var report = new ReconciliationReportDto
                {
                    BankStatementId = bankStatementId,
                    StatementDate = statement.StatementDate,
                    StartingBalance = statement.StartingBalance,
                    EndingBalance = statement.EndingBalance,
                    Transactions = transactionDtos,
                    TotalTransactions = transactions.Count,
                    MatchedTransactions = transactions.Count(t => t.IsMatched),
                    UnmatchedTransactions = transactions.Count(t => !t.IsMatched),
                    MatchedAmount = transactions.Where(t => t.IsMatched).Sum(t => t.Amount),
                    UnmatchedAmount = transactions.Where(t => !t.IsMatched).Sum(t => t.Amount),
                    Status = reconciliation?.Status ?? "Pending",
                    ReconciledDate = reconciliation?.ReconciledDate,
                    ReconciledByUserName = reconciliation?.ReconciledByUser?.Email
                };

                response.Data = report;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting reconciliation report");
                response.Success = false;
                response.Message = $"Error getting reconciliation report: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> ReconcileStatementAsync(long bankStatementId, long userId, string? notes = null)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                var existingReconciliation = await _repository.GetReconciliationByStatementIdAsync(bankStatementId);
                
                if (existingReconciliation != null)
                {
                    await _repository.UpdateReconciliationStatusAsync(existingReconciliation.Id, "Reconciled");
                }
                else
                {
                    var reconciliation = new BankReconciliation
                    {
                        BankStatementId = bankStatementId,
                        ReconciledDate = DateTime.Now,
                        ReconciledByUserId = userId,
                        Status = "Reconciled",
                        Notes = notes
                    };

                    await _repository.AddReconciliationAsync(reconciliation);
                }

                // Mark all matched transactions for this statement as reconciled
                await _repository.MarkMatchedTransactionsAsReconciledAsync(bankStatementId);

                response.Data = true;
                response.Message = "Statement reconciled successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reconciling statement");
                response.Success = false;
                response.Message = $"Error reconciling statement: {ex.Message}";
            }

            return response;
        }

        private async Task AutoMatchTransactionsAsync(long organizationId, long bankStatementId)
        {
            try
            {
                var bankTransactions = await _repository.GetUnmatchedTransactionsAsync(organizationId, bankStatementId);
                var ledgerEntriesResponse = await _generalLedgerService.GetEntriesByDateRangeAsync(
                    organizationId,
                    bankTransactions.Min(t => t.TransactionDate).AddDays(-3),
                    bankTransactions.Max(t => t.TransactionDate).AddDays(3)
                );

                if (!ledgerEntriesResponse.Success || ledgerEntriesResponse.Data == null)
                    return;

                var ledgerEntries = ledgerEntriesResponse.Data;

                foreach (var bankTransaction in bankTransactions)
                {
                    // Try to match by date (±3 days) and amount (exact match)
                    var match = ledgerEntries.FirstOrDefault(e =>
                        Math.Abs((e.TransactionDate - bankTransaction.TransactionDate).TotalDays) <= 3 &&
                        Math.Abs(e.Amount - bankTransaction.Amount) < 0.01m &&
                        !string.IsNullOrEmpty(e.Reference) &&
                        !string.IsNullOrEmpty(bankTransaction.Reference) &&
                        e.Reference.Contains(bankTransaction.Reference, StringComparison.OrdinalIgnoreCase)
                    );

                    if (match != null)
                    {
                        await _repository.UpdateTransactionMatchAsync(bankTransaction.Id, match.Id, true);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error during auto-matching transactions");
            }
        }

        private LoadBankStatementDto MapToDto(BankStatement statement)
        {
            return new LoadBankStatementDto
            {
                Id = statement.Id,
                OrganizationId = statement.OrganizationId,
                BankAccountId = statement.BankAccountId,
                BankAccountName = statement.BankAccount?.DisplayName,
                StatementDate = statement.StatementDate,
                StartingBalance = statement.StartingBalance,
                EndingBalance = statement.EndingBalance,
                CreatedAt = statement.CreatedAt
            };
        }

        private LoadBankStatementTransactionDto MapTransactionToDto(BankStatementTransaction transaction)
        {
            return new LoadBankStatementTransactionDto
            {
                Id = transaction.Id,
                BankStatementId = transaction.BankStatementId,
                TransactionDate = transaction.TransactionDate,
                Description = transaction.Description,
                Amount = transaction.Amount,
                Reference = transaction.Reference,
                CheckNumber = transaction.CheckNumber,
                IsMatched = transaction.IsMatched,
                MatchedLedgerEntryId = transaction.MatchedLedgerEntryId,
                MatchedLedgerEntryDescription = transaction.MatchedLedgerEntry?.Description,
                CreatedAt = transaction.CreatedAt
            };
        }
    }
}
