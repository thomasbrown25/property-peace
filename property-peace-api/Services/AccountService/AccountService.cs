using AutoMapper;
using brownstone_hub_api.Dtos.Account;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Accounts;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Services.AccountService
{
    public class AccountService : IAccountService
    {
        private readonly IAccountRepository _accountRepository;
        private readonly IMapper _mapper;
        private readonly ILogger<AccountService> _logger;

        public AccountService(
            IAccountRepository accountRepository,
            IMapper mapper,
            ILogger<AccountService> logger)
        {
            _accountRepository = accountRepository;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<ServiceResponse<List<LoadAccountDto>>> GetAccountsByOrganizationIdAsync(long organizationId)
        {
            var response = new ServiceResponse<List<LoadAccountDto>>();

            try
            {
                var accounts = await _accountRepository.GetAccountsByOrganizationIdAsync(organizationId);
                var dtos = accounts.Select(a => MapToDto(a)).ToList();
                response.Data = dtos;
                response.Message = "Accounts retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting accounts for organization {OrganizationId}", organizationId);
                response.Success = false;
                response.Message = $"Error getting accounts: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<List<LoadAccountDto>>> GetAccountsByTypeAsync(long organizationId, EAccountType accountType)
        {
            var response = new ServiceResponse<List<LoadAccountDto>>();

            try
            {
                var accounts = await _accountRepository.GetAccountsByTypeAsync(organizationId, accountType);
                var dtos = accounts.Select(a => MapToDto(a)).ToList();
                response.Data = dtos;
                response.Message = "Accounts retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting accounts by type for organization {OrganizationId}", organizationId);
                response.Success = false;
                response.Message = $"Error getting accounts: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<LoadAccountDto>> GetAccountByIdAsync(long id)
        {
            var response = new ServiceResponse<LoadAccountDto>();

            try
            {
                var account = await _accountRepository.GetAccountByIdAsync(id);
                if (account == null)
                {
                    response.Success = false;
                    response.Message = "Account not found";
                    return response;
                }

                response.Data = MapToDto(account);
                response.Message = "Account retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting account {Id}", id);
                response.Success = false;
                response.Message = $"Error getting account: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<List<LoadAccountDto>>> GetAccountHierarchyAsync(long organizationId)
        {
            var response = new ServiceResponse<List<LoadAccountDto>>();

            try
            {
                var accounts = await _accountRepository.GetAccountHierarchyAsync(organizationId);
                var dtos = accounts.Select(a => MapToDtoWithChildren(a)).ToList();
                response.Data = dtos;
                response.Message = "Account hierarchy retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting account hierarchy for organization {OrganizationId}", organizationId);
                response.Success = false;
                response.Message = $"Error getting account hierarchy: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<LoadAccountDto>> CreateAccountAsync(AddAccountDto accountDto)
        {
            var response = new ServiceResponse<LoadAccountDto>();

            try
            {
                // Business rule: User-created accounts are never system accounts
                accountDto.IsSystemAccount = false;

                var account = await _accountRepository.AddAccountAsync(accountDto);
                response.Data = MapToDto(account);
                response.Message = "Account created successfully";
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Invalid operation creating account");
                response.Success = false;
                response.Message = ex.Message;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating account");
                response.Success = false;
                response.Message = $"Error creating account: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<LoadAccountDto>> UpdateAccountAsync(UpdateAccountDto accountDto)
        {
            var response = new ServiceResponse<LoadAccountDto>();

            try
            {
                var account = await _accountRepository.UpdateAccountAsync(accountDto);
                response.Data = MapToDto(account);
                response.Message = "Account updated successfully";
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Account not found for update");
                response.Success = false;
                response.Message = ex.Message;
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Invalid operation updating account");
                response.Success = false;
                response.Message = ex.Message;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating account {Id}", accountDto.Id);
                response.Success = false;
                response.Message = $"Error updating account: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> DeleteAccountAsync(long id)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                var result = await _accountRepository.DeleteAccountAsync(id);
                response.Data = result;
                response.Message = result ? "Account deleted successfully" : "Account not found";
                response.Success = result;
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Invalid operation deleting account");
                response.Success = false;
                response.Message = ex.Message;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting account {Id}", id);
                response.Success = false;
                response.Message = $"Error deleting account: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> SeedStandardAccountsAsync(long organizationId)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                // Check if active accounts already exist for this organization
                var existingActiveAccounts = await _accountRepository.GetAccountsByOrganizationIdAsync(organizationId);
                if (existingActiveAccounts.Any())
                {
                    response.Success = false;
                    response.Message = "Accounts already exist for this organization";
                    response.Data = false;
                    return response;
                }

                // Create standard chart of accounts
                var standardAccounts = GetStandardAccounts(organizationId);
                int createdCount = 0;
                int reactivatedCount = 0;
                
                foreach (var accountDto in standardAccounts)
                {
                    // Check if account exists (including inactive ones)
                    var existingAccount = await _accountRepository.GetAccountByCodeAsync(organizationId, accountDto.AccountCode);
                    
                    if (existingAccount != null)
                    {
                        // Account exists but is inactive - reactivate it
                        if (!existingAccount.IsActive)
                        {
                            await _accountRepository.ReactivateAccountAsync(
                                existingAccount.Id,
                                accountDto.AccountName,
                                accountDto.Description ?? string.Empty,
                                accountDto.AccountType,
                                accountDto.IsSystemAccount
                            );
                            reactivatedCount++;
                        }
                        // If account exists and is active, skip it (shouldn't happen due to check above, but just in case)
                    }
                    else
                    {
                        // Account doesn't exist - create it
                        try
                        {
                            await _accountRepository.AddAccountAsync(accountDto);
                            createdCount++;
                        }
                        catch (InvalidOperationException ex)
                        {
                            // Account might have been created by another process, log and continue
                            _logger.LogWarning(ex, "Account {AccountCode} already exists, skipping", accountDto.AccountCode);
                        }
                    }
                }

                response.Data = true;
                if (reactivatedCount > 0)
                {
                    response.Message = $"Standard accounts seeded successfully. {createdCount} created, {reactivatedCount} reactivated.";
                }
                else
                {
                    response.Message = $"Standard accounts seeded successfully. {createdCount} accounts created.";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding standard accounts for organization {OrganizationId}", organizationId);
                response.Success = false;
                response.Message = $"Error seeding standard accounts: {ex.Message}";
            }

            return response;
        }

        private LoadAccountDto MapToDto(Models.Account account)
        {
            return new LoadAccountDto
            {
                Id = account.Id,
                OrganizationId = account.OrganizationId,
                AccountCode = account.AccountCode,
                AccountName = account.AccountName,
                AccountType = account.AccountType,
                ParentAccountId = account.ParentAccountId,
                ParentAccountName = account.ParentAccount?.AccountName,
                IsSystemAccount = account.IsSystemAccount,
                IsActive = account.IsActive,
                Description = account.Description,
                CreatedAt = account.CreatedAt,
                UpdatedAt = account.UpdatedAt,
                ChildAccounts = []
            };
        }

        private LoadAccountDto MapToDtoWithChildren(Models.Account account)
        {
            var dto = MapToDto(account);
            dto.ChildAccounts = account.ChildAccounts.Select(c => MapToDtoWithChildren(c)).ToList();
            return dto;
        }

        private List<AddAccountDto> GetStandardAccounts(long organizationId)
        {
            return new List<AddAccountDto>
            {
                // Assets (1000-1999)
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "1000", AccountName = "Cash", AccountType = EAccountType.Asset, Description = "Cash and cash equivalents", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "1100", AccountName = "Accounts Receivable", AccountType = EAccountType.Asset, Description = "Amounts owed by tenants", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "1200", AccountName = "Prepaid Expenses", AccountType = EAccountType.Asset, Description = "Prepaid insurance, rent, etc.", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "1500", AccountName = "Property", AccountType = EAccountType.Asset, Description = "Rental properties", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "1600", AccountName = "Accumulated Depreciation", AccountType = EAccountType.Asset, Description = "Accumulated depreciation on properties", IsSystemAccount = true },

                // Liabilities (2000-2999)
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "2000", AccountName = "Accounts Payable", AccountType = EAccountType.Liability, Description = "Amounts owed to vendors", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "2100", AccountName = "Security Deposits", AccountType = EAccountType.Liability, Description = "Tenant security deposits", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "2500", AccountName = "Mortgage Payable", AccountType = EAccountType.Liability, Description = "Mortgage loans on properties", IsSystemAccount = true },

                // Equity (3000-3999)
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "3000", AccountName = "Owner's Equity", AccountType = EAccountType.Equity, Description = "Owner's equity in the business", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "3100", AccountName = "Retained Earnings", AccountType = EAccountType.Equity, Description = "Accumulated profits", IsSystemAccount = true },

                // Income (4000-4999)
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "4000", AccountName = "Rent Income", AccountType = EAccountType.Income, Description = "Rental income from tenants", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "4100", AccountName = "Late Fees", AccountType = EAccountType.Income, Description = "Late payment fees", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "4200", AccountName = "Application Fees", AccountType = EAccountType.Income, Description = "Tenant application fees", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "4300", AccountName = "Other Income", AccountType = EAccountType.Income, Description = "Other miscellaneous income", IsSystemAccount = true },

                // Expenses (5000-5999)
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "5100", AccountName = "Maintenance Expense", AccountType = EAccountType.Expense, Description = "Property maintenance and repairs", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "5200", AccountName = "Utilities Expense", AccountType = EAccountType.Expense, Description = "Water, sewer, garbage, etc.", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "5300", AccountName = "Insurance Expense", AccountType = EAccountType.Expense, Description = "Property and liability insurance", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "5400", AccountName = "Property Tax Expense", AccountType = EAccountType.Expense, Description = "Property taxes", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "5500", AccountName = "Management Fees", AccountType = EAccountType.Expense, Description = "Property management fees", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "5600", AccountName = "Legal & Professional Fees", AccountType = EAccountType.Expense, Description = "Legal and accounting fees", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "5700", AccountName = "Advertising Expense", AccountType = EAccountType.Expense, Description = "Marketing and advertising costs", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "5800", AccountName = "Travel & Transportation", AccountType = EAccountType.Expense, Description = "Travel expenses related to properties", IsSystemAccount = true },
                new AddAccountDto { OrganizationId = organizationId, AccountCode = "5900", AccountName = "Other Expenses", AccountType = EAccountType.Expense, Description = "Other miscellaneous expenses", IsSystemAccount = true }
            };
        }
    }
}
