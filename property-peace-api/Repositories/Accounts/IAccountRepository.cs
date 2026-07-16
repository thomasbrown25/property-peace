using brownstone_hub_api.Dtos.Account;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.Accounts
{
    public interface IAccountRepository
    {
        Task<List<Account>> GetAccountsByOrganizationIdAsync(long organizationId);
        Task<List<Account>> GetAccountsByTypeAsync(long organizationId, EAccountType accountType);
        Task<Account?> GetAccountByIdAsync(long id);
        Task<Account?> GetAccountByCodeAsync(long organizationId, string accountCode);
        Task<List<Account>> GetAccountHierarchyAsync(long organizationId);
        Task<Account> AddAccountAsync(AddAccountDto accountDto);
        Task<Account> UpdateAccountAsync(UpdateAccountDto accountDto);
        Task<bool> DeleteAccountAsync(long id);
        Task<Account> ReactivateAccountAsync(long accountId, string accountName, string description, EAccountType accountType, bool isSystemAccount);
    }
}
