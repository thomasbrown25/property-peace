using brownstone_hub_api.Dtos.FutureExpense;

namespace brownstone_hub_api.Repositories.FutureExpenses
{
    public interface IFutureExpenseRepository
    {
        Task<LoadFutureExpenseDto> AddFutureExpense(AddFutureExpenseDto futureExpense, long? organizationId = null);
        Task<bool> DeleteFutureExpense(long futureExpenseId);
        Task<LoadFutureExpenseDto?> GetFutureExpenseById(long futureExpenseId);
        Task<List<LoadFutureExpenseDto>> GetFutureExpensesByOrganizationId(long organizationId, long? propertyId = null);
        Task<List<LoadFutureExpenseDto>> GetFutureExpensesByLandlordId(long landlordId, long? propertyId = null);
    }
}
