using brownstone_hub_api.Dtos.Account;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Services.AccountService
{
    public interface IAccountService
    {
        Task<ServiceResponse<List<LoadAccountDto>>> GetAccountsByOrganizationIdAsync(long organizationId);
        Task<ServiceResponse<List<LoadAccountDto>>> GetAccountsByTypeAsync(long organizationId, EAccountType accountType);
        Task<ServiceResponse<LoadAccountDto>> GetAccountByIdAsync(long id);
        Task<ServiceResponse<List<LoadAccountDto>>> GetAccountHierarchyAsync(long organizationId);
        Task<ServiceResponse<LoadAccountDto>> CreateAccountAsync(AddAccountDto accountDto);
        Task<ServiceResponse<LoadAccountDto>> UpdateAccountAsync(UpdateAccountDto accountDto);
        Task<ServiceResponse<bool>> DeleteAccountAsync(long id);
        Task<ServiceResponse<bool>> SeedStandardAccountsAsync(long organizationId);
    }
}
