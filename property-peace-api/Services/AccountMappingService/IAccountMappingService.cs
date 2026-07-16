using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.AccountMappingService
{
    public interface IAccountMappingService
    {
        Task<Account?> GetOrCreateExpenseAccountAsync(long organizationId, string category);
        Task<Account?> GetRentIncomeAccountAsync(long organizationId);
    }
}
