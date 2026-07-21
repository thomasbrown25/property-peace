using brownstone_hub_api.Dtos.BankAccount;

namespace brownstone_hub_api.Services.BankAccountService
{
    public interface IBankAccountService
    {
        Task<ServiceResponse<List<LoadBankAccountDto>>> GetBankAccountsByOrganizationIdAsync(long organizationId);
        Task<ServiceResponse<LoadBankAccountDto>> GetBankAccountByIdAsync(long id, long organizationId);
        Task<ServiceResponse<LoadBankAccountDto>> CreateBankAccountAsync(CreateBankAccountDto bankAccount);
        Task<ServiceResponse<LoadBankAccountDto>> UpdateBankAccountAsync(UpdateBankAccountDto bankAccount, long organizationId);
        Task<ServiceResponse<bool>> DeleteBankAccountAsync(long id, long organizationId);
    }
}

