using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Account;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Accounts
{
    public class AccountRepository : IAccountRepository
    {
        private readonly DataContext _context;

        public AccountRepository(DataContext context)
        {
            _context = context;
        }

        public async Task<List<Account>> GetAccountsByOrganizationIdAsync(long organizationId)
        {
            return await _context.Accounts
                .Where(a => a.OrganizationId == organizationId && a.IsActive)
                .Include(a => a.ParentAccount)
                .OrderBy(a => a.AccountCode)
                .ToListAsync();
        }

        public async Task<List<Account>> GetAccountsByTypeAsync(long organizationId, EAccountType accountType)
        {
            return await _context.Accounts
                .Where(a => a.OrganizationId == organizationId && a.AccountType == accountType && a.IsActive)
                .Include(a => a.ParentAccount)
                .OrderBy(a => a.AccountCode)
                .ToListAsync();
        }

        public async Task<Account?> GetAccountByIdAsync(long id)
        {
            return await _context.Accounts
                .Include(a => a.ParentAccount)
                .Include(a => a.ChildAccounts)
                .FirstOrDefaultAsync(a => a.Id == id);
        }

        public async Task<Account?> GetAccountByCodeAsync(long organizationId, string accountCode)
        {
            return await _context.Accounts
                .FirstOrDefaultAsync(a => a.OrganizationId == organizationId && a.AccountCode == accountCode);
        }

        public async Task<List<Account>> GetAccountHierarchyAsync(long organizationId)
        {
            var allAccounts = await _context.Accounts
                .Where(a => a.OrganizationId == organizationId && a.IsActive)
                .Include(a => a.ChildAccounts)
                .OrderBy(a => a.AccountCode)
                .ToListAsync();

            // Return only top-level accounts (those without a parent)
            return allAccounts.Where(a => a.ParentAccountId == null).ToList();
        }

        public async Task<Account> AddAccountAsync(AddAccountDto accountDto)
        {
            // Check if account code already exists for this organization
            var existing = await GetAccountByCodeAsync(accountDto.OrganizationId, accountDto.AccountCode);
            if (existing != null)
            {
                throw new InvalidOperationException($"Account code '{accountDto.AccountCode}' already exists for this organization.");
            }

            var account = new Account
            {
                OrganizationId = accountDto.OrganizationId,
                AccountCode = accountDto.AccountCode,
                AccountName = accountDto.AccountName,
                AccountType = accountDto.AccountType,
                ParentAccountId = accountDto.ParentAccountId,
                Description = accountDto.Description,
                IsSystemAccount = accountDto.IsSystemAccount,
                IsActive = true,
                CreatedAt = DateTime.Now
            };

            _context.Accounts.Add(account);
            await _context.SaveChangesAsync();

            return account;
        }

        public async Task<Account> UpdateAccountAsync(UpdateAccountDto accountDto)
        {
            var account = await _context.Accounts.FindAsync(accountDto.Id);
            if (account == null)
            {
                throw new ArgumentException("Account not found");
            }

            // Prevent editing system accounts
            if (account.IsSystemAccount)
            {
                throw new InvalidOperationException("System accounts cannot be modified.");
            }

            // Check if account code is being changed and if it conflicts
            if (!string.IsNullOrWhiteSpace(accountDto.AccountCode) && accountDto.AccountCode != account.AccountCode)
            {
                var existing = await GetAccountByCodeAsync(account.OrganizationId, accountDto.AccountCode);
                if (existing != null && existing.Id != account.Id)
                {
                    throw new InvalidOperationException($"Account code '{accountDto.AccountCode}' already exists for this organization.");
                }
                account.AccountCode = accountDto.AccountCode;
            }

            if (!string.IsNullOrWhiteSpace(accountDto.AccountName))
            {
                account.AccountName = accountDto.AccountName;
            }

            if (accountDto.AccountType.HasValue)
            {
                account.AccountType = accountDto.AccountType.Value;
            }

            if (accountDto.ParentAccountId.HasValue)
            {
                // Prevent circular references
                if (accountDto.ParentAccountId == account.Id)
                {
                    throw new InvalidOperationException("An account cannot be its own parent.");
                }
                account.ParentAccountId = accountDto.ParentAccountId;
            }

            if (!string.IsNullOrWhiteSpace(accountDto.Description))
            {
                account.Description = accountDto.Description;
            }

            if (accountDto.IsActive.HasValue)
            {
                account.IsActive = accountDto.IsActive.Value;
            }

            account.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return account;
        }

        public async Task<bool> DeleteAccountAsync(long id)
        {
            var account = await _context.Accounts
                .Include(a => a.ChildAccounts)
                .FirstOrDefaultAsync(a => a.Id == id);
            
            if (account == null)
            {
                return false;
            }

            // Prevent deleting system accounts
            if (account.IsSystemAccount)
            {
                throw new InvalidOperationException("System accounts cannot be deleted.");
            }

            // Prevent deleting accounts with child accounts
            if (account.ChildAccounts.Any())
            {
                throw new InvalidOperationException("Cannot delete an account that has child accounts. Delete or reassign child accounts first.");
            }

            // Soft delete by setting IsActive to false
            account.IsActive = false;
            account.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<Account> ReactivateAccountAsync(long accountId, string accountName, string description, EAccountType accountType, bool isSystemAccount)
        {
            var account = await _context.Accounts.FindAsync(accountId);
            if (account == null)
            {
                throw new ArgumentException("Account not found");
            }

            // Reactivate the account and update its properties
            account.IsActive = true;
            account.AccountName = accountName;
            account.Description = description;
            account.AccountType = accountType;
            account.IsSystemAccount = isSystemAccount;
            account.UpdatedAt = DateTime.Now;
            
            await _context.SaveChangesAsync();
            return account;
        }
    }
}
