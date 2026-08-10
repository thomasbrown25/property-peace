using brownstone_hub_api.Dtos.FutureExpense;

namespace brownstone_hub_api.Services.FutureExpenseService
{
    public interface IFutureExpenseService
    {
        Task<ServiceResponse<LoadFutureExpenseDto>> AddFutureExpense(AddFutureExpenseDto futureExpense);
        Task<ServiceResponse<bool>> DeleteFutureExpense(long futureExpenseId);
        Task<ServiceResponse<LoadFutureExpenseDto>> GetFutureExpenseById(long futureExpenseId);
        Task<ServiceResponse<List<LoadFutureExpenseDto>>> GetFutureExpenses(long? propertyId = null, long? unitId = null);
    }
}
