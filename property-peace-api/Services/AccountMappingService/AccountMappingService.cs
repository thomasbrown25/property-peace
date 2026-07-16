using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Accounts;
using brownstone_hub_api.Dtos.Account;
using brownstone_hub_api.Services.AccountService;

namespace brownstone_hub_api.Services.AccountMappingService
{
    public class AccountMappingService : IAccountMappingService
    {
        private readonly IAccountRepository _accountRepository;
        private readonly IAccountService _accountService;
        private readonly ILogger<AccountMappingService> _logger;

        // Mapping of expense categories to account codes
        private static readonly Dictionary<string, (string Code, string Name)> CategoryToAccountMap = new()
        {
            { "Maintenance", ("5100", "Maintenance Expense") },
            { "Repairs", ("5100", "Maintenance Expense") },
            { "Utilities", ("5200", "Utilities Expense") },
            { "Insurance", ("5300", "Insurance Expense") },
            { "Property Taxes", ("5400", "Tax Expense") },
            { "Taxes", ("5400", "Tax Expense") },
            { "Property Management", ("5500", "Property Management Expense") },
            { "Legal", ("5600", "Legal Expense") },
            { "Accounting", ("5600", "Legal Expense") }, // Accounting fees grouped with legal
            { "Advertising", ("5700", "Advertising Expense") },
            { "Marketing", ("5700", "Advertising Expense") },
            { "Cleaning", ("5800", "Cleaning Expense") },
            { "Landscaping", ("5800", "Cleaning Expense") },
            { "Supplies", ("5900", "Supplies Expense") },
            { "Other", ("5999", "Other Expense") }
        };

        public AccountMappingService(
            IAccountRepository accountRepository,
            IAccountService accountService,
            ILogger<AccountMappingService> logger)
        {
            _accountRepository = accountRepository;
            _accountService = accountService;
            _logger = logger;
        }

        public async Task<Account?> GetOrCreateExpenseAccountAsync(long organizationId, string category)
        {
            try
            {
                // Get mapping for category
                if (!CategoryToAccountMap.TryGetValue(category, out var accountInfo))
                {
                    // Default to "Other Expense" if category not found
                    accountInfo = CategoryToAccountMap["Other"];
                }

                // Try to get existing account by code
                var existingAccount = await _accountRepository.GetAccountByCodeAsync(organizationId, accountInfo.Code);
                if (existingAccount != null)
                {
                    return existingAccount;
                }

                // Account doesn't exist, create it
                var addAccountDto = new AddAccountDto
                {
                    OrganizationId = organizationId,
                    AccountCode = accountInfo.Code,
                    AccountName = accountInfo.Name,
                    AccountType = EAccountType.Expense,
                    ParentAccountId = null,
                    Description = $"Expense account for {category}",
                    IsSystemAccount = false
                };

                var createResponse = await _accountService.CreateAccountAsync(addAccountDto);
                if (createResponse.Success && createResponse.Data != null)
                {
                    return await _accountRepository.GetAccountByIdAsync(createResponse.Data.Id);
                }

                _logger.LogWarning("Failed to create expense account for category {Category}", category);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting or creating expense account for category {Category}", category);
                return null;
            }
        }

        public async Task<Account?> GetRentIncomeAccountAsync(long organizationId)
        {
            try
            {
                // Rent Income account code is 4000
                var account = await _accountRepository.GetAccountByCodeAsync(organizationId, "4000");
                if (account != null)
                {
                    return account;
                }

                // Account doesn't exist, create it
                var addAccountDto = new AddAccountDto
                {
                    OrganizationId = organizationId,
                    AccountCode = "4000",
                    AccountName = "Rent Income",
                    AccountType = EAccountType.Income,
                    ParentAccountId = null,
                    Description = "Rental income from tenants",
                    IsSystemAccount = false
                };

                var createResponse = await _accountService.CreateAccountAsync(addAccountDto);
                if (createResponse.Success && createResponse.Data != null)
                {
                    return await _accountRepository.GetAccountByIdAsync(createResponse.Data.Id);
                }

                _logger.LogWarning("Failed to create Rent Income account");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting or creating Rent Income account");
                return null;
            }
        }
    }
}
