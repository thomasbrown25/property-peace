using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.BankAccount;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.BankAccounts
{
    public class BankAccountRepository : IBankAccountRepository
    {
        private readonly DataContext _context;

        public BankAccountRepository(DataContext context)
        {
            _context = context;
        }

        public async Task<List<BankAccount>> GetBankAccountsByOrganizationIdAsync(long organizationId)
        {
            return await _context.BankAccounts
                .Where(ba => ba.OrganizationId == organizationId && ba.IsActive)
                .OrderByDescending(ba => ba.IsDefault)
                .ThenByDescending(ba => ba.CreatedAt)
                .ToListAsync();
        }

        public async Task<BankAccount?> GetBankAccountByIdAsync(long id, long organizationId)
        {
            return await _context.BankAccounts
                .FirstOrDefaultAsync(ba => ba.Id == id && ba.OrganizationId == organizationId && ba.IsActive);
        }

        public async Task<BankAccount?> GetBankAccountByStripeAccountIdAsync(string stripeAccountId)
        {
            return await _context.BankAccounts
                .FirstOrDefaultAsync(ba => ba.StripeAccountId == stripeAccountId);
        }

        public async Task<BankAccount?> GetBankAccountByOrganizationAndStripeAccountIdAsync(long organizationId, string stripeAccountId)
        {
            return await _context.BankAccounts
                .FirstOrDefaultAsync(ba => ba.OrganizationId == organizationId && ba.StripeAccountId == stripeAccountId && ba.IsActive);
        }

        public async Task<BankAccount> AddBankAccountAsync(CreateBankAccountDto bankAccountDto)
        {
            // If this is set as default, unset all other defaults for this organization
            if (bankAccountDto.IsDefault)
            {
                var existingDefaults = await _context.BankAccounts
                    .Where(ba => ba.OrganizationId == bankAccountDto.OrganizationId && ba.IsDefault)
                    .ToListAsync();
                
                foreach (var existing in existingDefaults)
                {
                    existing.IsDefault = false;
                }
            }

            var bankAccount = new BankAccount
            {
                OrganizationId = bankAccountDto.OrganizationId,
                StripeAccountId = bankAccountDto.StripeAccountId,
                DisplayName = bankAccountDto.DisplayName,
                Last4 = bankAccountDto.Last4,
                BankName = bankAccountDto.BankName,
                AccountType = bankAccountDto.AccountType,
                IsDefault = bankAccountDto.IsDefault,
                IsActive = true,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.BankAccounts.Add(bankAccount);
            await _context.SaveChangesAsync();

            return bankAccount;
        }

        public async Task<BankAccount> UpdateBankAccountAsync(UpdateBankAccountDto bankAccountDto, long organizationId)
        {
            var bankAccount = await _context.BankAccounts
                .FirstOrDefaultAsync(ba => ba.Id == bankAccountDto.Id && ba.OrganizationId == organizationId && ba.IsActive);
            if (bankAccount == null)
            {
                throw new ArgumentException("Bank account not found");
            }

            if (!string.IsNullOrWhiteSpace(bankAccountDto.DisplayName))
            {
                bankAccount.DisplayName = bankAccountDto.DisplayName;
            }

            if (bankAccountDto.IsActive.HasValue)
            {
                bankAccount.IsActive = bankAccountDto.IsActive.Value;
            }

            // Handle default flag - if setting to true, unset others
            if (bankAccountDto.IsDefault.HasValue)
            {
                if (bankAccountDto.IsDefault.Value && !bankAccount.IsDefault)
                {
                    var existingDefaults = await _context.BankAccounts
                        .Where(ba => ba.OrganizationId == bankAccount.OrganizationId && ba.Id != bankAccount.Id && ba.IsDefault)
                        .ToListAsync();
                    
                    foreach (var existing in existingDefaults)
                    {
                        existing.IsDefault = false;
                    }
                }
                bankAccount.IsDefault = bankAccountDto.IsDefault.Value;
            }

            bankAccount.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return bankAccount;
        }

        public async Task<bool> DeleteBankAccountAsync(long id, long organizationId)
        {
            var bankAccount = await _context.BankAccounts
                .FirstOrDefaultAsync(ba => ba.Id == id && ba.OrganizationId == organizationId && ba.IsActive);
            if (bankAccount == null)
            {
                return false;
            }

            // Soft delete by setting IsActive to false
            bankAccount.IsActive = false;
            bankAccount.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return true;
        }
    }
}

