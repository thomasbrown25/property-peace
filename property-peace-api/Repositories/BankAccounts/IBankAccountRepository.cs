using brownstone_hub_api.Dtos.BankAccount;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.BankAccounts
{
    public interface IBankAccountRepository
    {
        Task<List<BankAccount>> GetBankAccountsByOrganizationIdAsync(long organizationId);
        Task<BankAccount?> GetBankAccountByIdAsync(long id);
        Task<BankAccount?> GetBankAccountByStripeAccountIdAsync(string stripeAccountId);
        Task<BankAccount?> GetBankAccountByOrganizationAndStripeAccountIdAsync(long organizationId, string stripeAccountId);
        Task<BankAccount> AddBankAccountAsync(CreateBankAccountDto bankAccount);
        Task<BankAccount> UpdateBankAccountAsync(UpdateBankAccountDto bankAccount);
        Task<bool> DeleteBankAccountAsync(long id);
    }
}

