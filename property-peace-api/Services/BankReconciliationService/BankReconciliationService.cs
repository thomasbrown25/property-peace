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
        internal const int MaxUploadTransactions = 10_000;
        private const int MaxDescriptionLength = 1_000;
        private const int MaxReferenceLength = 200;
        private const int MaxCheckNumberLength = 100;
        private const decimal MaxSqlMoneyValue = 9_999_999_999_999_999.99m;

        private readonly IBankReconciliationRepository _repository;
        private readonly IGeneralLedgerService _generalLedgerService;
        private readonly ILogger<BankReconciliationService> _logger;

        public BankReconciliationService(
            IBankReconciliationRepository repository,
            IGeneralLedgerService generalLedgerService,
            IMapper mapper,
            ILogger<BankReconciliationService> logger)
        {
            _repository = repository;
            _generalLedgerService = generalLedgerService;
            _logger = logger;
        }

        public async Task<ServiceResponse<LoadBankStatementDto>> UploadBankStatementAsync(long organizationId, UploadBankStatementDto statementDto)
        {
            var response = new ServiceResponse<LoadBankStatementDto>();
            try
            {
                if (statementDto.Transactions == null || statementDto.Transactions.Count == 0)
                    return Fail(response, "A bank statement must contain at least one transaction.");

                if (statementDto.Transactions.Count > MaxUploadTransactions)
                    return Fail(response, $"A bank statement cannot contain more than {MaxUploadTransactions} transactions.", 413);

                if (!statementDto.StartingBalance.HasValue || !statementDto.EndingBalance.HasValue)
                    return Fail(response, "Starting and ending balances are required for truthful reconciliation.");

                if (!IsSupportedMoney(statementDto.StartingBalance.Value) || !IsSupportedMoney(statementDto.EndingBalance.Value))
                    return Fail(response, "Statement balances exceed the supported monetary range.");

                var invalidTransaction = statementDto.Transactions.FirstOrDefault(t =>
                    t.TransactionDate == default ||
                    !IsSupportedMoney(t.Amount) ||
                    t.Description?.Length > MaxDescriptionLength ||
                    t.Reference?.Length > MaxReferenceLength ||
                    t.CheckNumber?.Length > MaxCheckNumberLength);
                if (invalidTransaction != null)
                    return Fail(response, "A transaction contains an invalid date, amount, or overlong text field.");

                var latestTransactionDate = statementDto.Transactions.Max(t => t.TransactionDate);
                if (statementDto.StatementDate.HasValue && statementDto.StatementDate.Value < latestTransactionDate)
                    return Fail(response, "Statement date cannot be earlier than its latest transaction date.");

                if (statementDto.BankAccountId.HasValue &&
                    !await _repository.BankAccountBelongsToOrganizationAsync(organizationId, statementDto.BankAccountId.Value))
                    return Fail(response, "Bank account not found.", 404);

                var statement = new BankStatement
                {
                    OrganizationId = organizationId,
                    BankAccountId = statementDto.BankAccountId,
                    StatementDate = statementDto.StatementDate ?? latestTransactionDate,
                    StartingBalance = statementDto.StartingBalance,
                    EndingBalance = statementDto.EndingBalance
                };
                var transactions = statementDto.Transactions.Select(t => new BankStatementTransaction
                {
                    TransactionDate = t.TransactionDate,
                    Description = t.Description,
                    Amount = t.Amount,
                    Reference = t.Reference,
                    CheckNumber = t.CheckNumber,
                    IsMatched = false,
                    IsReconciled = false
                }).ToList();

                var saved = await _repository.AddBankStatementWithTransactionsAsync(statement, transactions);
                await AutoMatchTransactionsAsync(organizationId, saved.Id);
                response.Data = MapToDto(saved);
                response.Message = "Bank statement uploaded successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading bank statement for organization {OrganizationId}", organizationId);
                Fail(response, "Bank statement upload failed.");
            }
            return response;
        }

        public async Task<ServiceResponse<List<LoadBankStatementTransactionDto>>> GetUnmatchedTransactionsAsync(long organizationId, long? bankStatementId = null)
        {
            var response = new ServiceResponse<List<LoadBankStatementTransactionDto>>();
            try
            {
                response.Data = (await _repository.GetUnmatchedTransactionsAsync(organizationId, bankStatementId))
                    .Select(MapTransactionToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unmatched transactions for organization {OrganizationId}", organizationId);
                Fail(response, "Unable to retrieve unmatched transactions.");
            }
            return response;
        }

        public async Task<ServiceResponse<List<LoadGeneralLedgerEntryDto>>> GetUnmatchedLedgerEntriesAsync(long organizationId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var response = new ServiceResponse<List<LoadGeneralLedgerEntryDto>>();
            try
            {
                startDate ??= DateTime.Today.AddMonths(-3);
                endDate ??= DateTime.Today;
                var entries = await _generalLedgerService.GetEntriesByDateRangeAsync(organizationId, startDate.Value, endDate.Value);
                if (!entries.Success || entries.Data == null)
                    return Fail(response, "Failed to retrieve ledger entries.");

                // Reconciled matches also consume a ledger entry; there is no split model.
                var matchedIds = (await _repository.GetAllTransactionsAsync(organizationId))
                    .Where(t => t.IsMatched && t.MatchedLedgerEntryId.HasValue)
                    .Select(t => t.MatchedLedgerEntryId!.Value)
                    .ToHashSet();
                response.Data = entries.Data.Where(e => !matchedIds.Contains(e.Id)).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unmatched ledger entries for organization {OrganizationId}", organizationId);
                Fail(response, "Unable to retrieve unmatched ledger entries.");
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> MatchTransactionAsync(long organizationId, long bankTransactionId, long ledgerEntryId)
        {
            var response = new ServiceResponse<bool>();
            try
            {
                if (!await _repository.TryMatchTransactionAsync(organizationId, bankTransactionId, ledgerEntryId))
                    return Fail(response, "Transaction or ledger entry was not found, is locked, or is already matched.", 409);
                response.Data = true;
                response.Message = "Transaction matched successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error matching bank transaction {TransactionId}", bankTransactionId);
                Fail(response, "Unable to match transaction.");
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> UnmatchTransactionAsync(long organizationId, long bankTransactionId)
        {
            var response = new ServiceResponse<bool>();
            try
            {
                if (!await _repository.TryUnmatchTransactionAsync(organizationId, bankTransactionId))
                    return Fail(response, "Transaction was not found or belongs to a reconciled statement.", 409);
                response.Data = true;
                response.Message = "Transaction unmatched successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unmatching bank transaction {TransactionId}", bankTransactionId);
                Fail(response, "Unable to unmatch transaction.");
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> DeleteTransactionAsync(long organizationId, long bankTransactionId)
        {
            var response = new ServiceResponse<bool>();
            try
            {
                if (!await _repository.DeleteTransactionAsync(organizationId, bankTransactionId))
                    return Fail(response, "Transaction was not found or is reconciled.", 409);
                response.Data = true;
                response.Message = "Transaction deleted successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting bank transaction {TransactionId}", bankTransactionId);
                Fail(response, "Unable to delete transaction.");
            }
            return response;
        }

        public async Task<ServiceResponse<int>> ClearUnmatchedTransactionsAsync(long organizationId)
        {
            var response = new ServiceResponse<int>();
            try
            {
                response.Data = await _repository.DeleteAllUnmatchedTransactionsAsync(organizationId);
                response.Message = $"Successfully deleted {response.Data} unmatched transaction(s)";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing unmatched transactions for organization {OrganizationId}", organizationId);
                Fail(response, "Unable to clear unmatched transactions.");
            }
            return response;
        }

        public async Task<ServiceResponse<ReconciliationReportDto>> GetReconciliationReportAsync(long organizationId, long bankStatementId)
        {
            var response = new ServiceResponse<ReconciliationReportDto>();
            try
            {
                var statement = await _repository.GetBankStatementByIdAsync(organizationId, bankStatementId);
                if (statement == null)
                    return Fail(response, "Bank statement not found.", 404);

                var transactions = await _repository.GetTransactionsByStatementIdAsync(organizationId, bankStatementId);
                var reconciliation = await _repository.GetReconciliationByStatementIdAsync(organizationId, bankStatementId);
                decimal? difference = statement.StartingBalance.HasValue && statement.EndingBalance.HasValue
                    ? statement.StartingBalance.Value + transactions.Sum(t => t.Amount) - statement.EndingBalance.Value
                    : null;
                response.Data = new ReconciliationReportDto
                {
                    BankStatementId = bankStatementId,
                    StatementDate = statement.StatementDate,
                    StartingBalance = statement.StartingBalance,
                    EndingBalance = statement.EndingBalance,
                    ExpectedEndingBalance = statement.StartingBalance.HasValue
                        ? statement.StartingBalance.Value + transactions.Sum(t => t.Amount)
                        : null,
                    Difference = difference,
                    Transactions = transactions.Select(MapTransactionToDto).ToList(),
                    TotalTransactions = transactions.Count,
                    MatchedTransactions = transactions.Count(t => t.IsMatched),
                    UnmatchedTransactions = transactions.Count(t => !t.IsMatched),
                    MatchedAmount = transactions.Where(t => t.IsMatched).Sum(t => t.Amount),
                    UnmatchedAmount = transactions.Where(t => !t.IsMatched).Sum(t => t.Amount),
                    Status = reconciliation?.Status ?? "Pending",
                    ReconciledDate = reconciliation?.ReconciledDate,
                    ReconciledByUserName = reconciliation?.ReconciledByUser?.Email
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting reconciliation report {StatementId}", bankStatementId);
                Fail(response, "Unable to retrieve reconciliation report.");
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> ReconcileStatementAsync(long organizationId, long bankStatementId, long userId, string? notes = null)
        {
            var response = new ServiceResponse<bool>();
            try
            {
                if (!await _repository.TryReconcileStatementAsync(organizationId, bankStatementId, userId, notes))
                    return Fail(response, "Statement cannot be reconciled: it must exist, have balances, have no unmatched rows, and have zero difference.", 409);
                response.Data = true;
                response.Message = "Statement reconciled successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reconciling statement {StatementId}", bankStatementId);
                Fail(response, "Unable to reconcile statement.");
            }
            return response;
        }

        private async Task AutoMatchTransactionsAsync(long organizationId, long bankStatementId)
        {
            try
            {
                var bankTransactions = await _repository.GetUnmatchedTransactionsAsync(organizationId, bankStatementId);
                if (bankTransactions.Count == 0)
                    return;
                var ledgerResponse = await _generalLedgerService.GetEntriesByDateRangeAsync(
                    organizationId,
                    bankTransactions.Min(t => t.TransactionDate).AddDays(-3),
                    bankTransactions.Max(t => t.TransactionDate).AddDays(3));
                if (!ledgerResponse.Success || ledgerResponse.Data == null)
                    return;

                foreach (var bankTransaction in bankTransactions)
                {
                    var match = ledgerResponse.Data.FirstOrDefault(e =>
                        Math.Abs((e.TransactionDate - bankTransaction.TransactionDate).TotalDays) <= 3 &&
                        Math.Abs(e.Amount - bankTransaction.Amount) < 0.01m &&
                        !string.IsNullOrEmpty(e.Reference) &&
                        !string.IsNullOrEmpty(bankTransaction.Reference) &&
                        e.Reference.Contains(bankTransaction.Reference, StringComparison.OrdinalIgnoreCase));
                    if (match != null && await _repository.TryMatchTransactionAsync(organizationId, bankTransaction.Id, match.Id))
                        ledgerResponse.Data.Remove(match);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Auto-match failed for statement {StatementId}", bankStatementId);
            }
        }

        private static ServiceResponse<T> Fail<T>(ServiceResponse<T> response, string message, int statusCode = 400)
        {
            response.Success = false;
            response.Message = message;
            response.StatusCode = statusCode;
            return response;
        }

        private static bool IsSupportedMoney(decimal value) => Math.Abs(value) <= MaxSqlMoneyValue;

        private static LoadBankStatementDto MapToDto(BankStatement statement) => new()
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

        private static LoadBankStatementTransactionDto MapTransactionToDto(BankStatementTransaction transaction) => new()
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
