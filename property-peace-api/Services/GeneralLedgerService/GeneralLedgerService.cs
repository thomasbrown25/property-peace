using AutoMapper;
using brownstone_hub_api.Dtos.GeneralLedger;
using brownstone_hub_api.Repositories.GeneralLedger;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Services.GeneralLedgerService
{
    public class GeneralLedgerService : IGeneralLedgerService
    {
        private readonly IGeneralLedgerRepository _repository;
        private readonly IMapper _mapper;
        private readonly ILogger<GeneralLedgerService> _logger;

        public GeneralLedgerService(
            IGeneralLedgerRepository repository,
            IMapper mapper,
            ILogger<GeneralLedgerService> logger)
        {
            _repository = repository;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<ServiceResponse<LoadGeneralLedgerEntryDto>> CreateLedgerEntryAsync(
            long organizationId,
            long accountId,
            long? transactionId,
            string transactionType,
            decimal amount,
            DateTime transactionDate,
            string? description = null,
            string? reference = null)
        {
            var response = new ServiceResponse<LoadGeneralLedgerEntryDto>();

            try
            {
                var entry = new Models.GeneralLedgerEntry
                {
                    OrganizationId = organizationId,
                    AccountId = accountId,
                    TransactionId = transactionId,
                    TransactionType = transactionType,
                    Amount = amount,
                    TransactionDate = transactionDate,
                    Description = description,
                    Reference = reference
                };

                var created = await _repository.AddEntryAsync(entry);
                var dto = MapToDto(created);
                response.Data = dto;
                response.Message = "Ledger entry created successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating ledger entry");
                response.Success = false;
                response.Message = $"Error creating ledger entry: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<List<LoadGeneralLedgerEntryDto>>> GetEntriesByAccountAsync(long organizationId, long accountId, DateTime? startDate = null, DateTime? endDate = null)
        {
            var response = new ServiceResponse<List<LoadGeneralLedgerEntryDto>>();

            try
            {
                var entries = await _repository.GetEntriesByAccountAsync(organizationId, accountId, startDate, endDate);
                var dtos = entries.Select(e => MapToDto(e)).ToList();
                response.Data = dtos;
                response.Message = "Ledger entries retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting ledger entries by account");
                response.Success = false;
                response.Message = $"Error getting ledger entries: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<List<LoadGeneralLedgerEntryDto>>> GetEntriesByDateRangeAsync(long organizationId, DateTime startDate, DateTime endDate)
        {
            var response = new ServiceResponse<List<LoadGeneralLedgerEntryDto>>();

            try
            {
                var entries = await _repository.GetEntriesByDateRangeAsync(organizationId, startDate, endDate);
                var dtos = entries.Select(e => MapToDto(e)).ToList();
                response.Data = dtos;
                response.Message = "Ledger entries retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting ledger entries by date range");
                response.Success = false;
                response.Message = $"Error getting ledger entries: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<decimal>> GetAccountBalanceAsync(long organizationId, long accountId, DateTime? asOfDate = null)
        {
            var response = new ServiceResponse<decimal>();

            try
            {
                var balance = await _repository.GetAccountBalanceAsync(organizationId, accountId, asOfDate);
                response.Data = balance;
                response.Message = "Account balance retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting account balance");
                response.Success = false;
                response.Message = $"Error getting account balance: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<List<AccountBalanceDto>>> GetAccountBalancesAsync(long organizationId, DateTime? asOfDate = null)
        {
            var response = new ServiceResponse<List<AccountBalanceDto>>();

            try
            {
                var balances = await _repository.GetAccountBalancesAsync(organizationId, asOfDate);
                response.Data = balances;
                response.Message = "Account balances retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting account balances");
                response.Success = false;
                response.Message = $"Error getting account balances: {ex.Message}";
            }

            return response;
        }

        private LoadGeneralLedgerEntryDto MapToDto(Models.GeneralLedgerEntry entry)
        {
            return new LoadGeneralLedgerEntryDto
            {
                Id = entry.Id,
                OrganizationId = entry.OrganizationId,
                AccountId = entry.AccountId,
                AccountCode = entry.Account?.AccountCode ?? string.Empty,
                AccountName = entry.Account?.AccountName ?? string.Empty,
                TransactionId = entry.TransactionId,
                TransactionType = entry.TransactionType,
                Amount = entry.Amount,
                DebitAmount = entry.DebitAmount,
                CreditAmount = entry.CreditAmount,
                TransactionDate = entry.TransactionDate,
                Description = entry.Description,
                Reference = entry.Reference,
                CreatedAt = entry.CreatedAt,
                UpdatedAt = entry.UpdatedAt
            };
        }
    }
}
