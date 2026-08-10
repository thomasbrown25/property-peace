using brownstone_hub_api.Dtos.FutureExpense;

namespace brownstone_hub_api.Repositories.FutureExpenses
{
    public interface IFutureExpenseRepository
    {
        Task<LoadFutureExpenseDto> AddFutureExpense(AddFutureExpenseDto futureExpense, long organizationId);
        Task<bool> DeleteFutureExpense(long futureExpenseId, long organizationId);
        Task<LoadFutureExpenseDto?> GetFutureExpenseById(long futureExpenseId, long organizationId);
        Task<List<LoadFutureExpenseDto>> GetFutureExpensesByOrganizationId(long organizationId, long? propertyId = null, long? unitId = null);
    }
}
