using brownstone_hub_api.Dtos.RecurringExpense;

namespace brownstone_hub_api.Services.RecurringExpenseService
{
    public interface IRecurringExpenseService
    {
        Task<ServiceResponse<LoadRecurringExpenseDto>> AddRecurringExpense(AddRecurringExpenseDto recurringExpense);
        Task<ServiceResponse<LoadRecurringExpenseDto>> UpdateRecurringExpense(UpdateRecurringExpenseDto recurringExpense);
        Task<ServiceResponse<bool>> DeleteRecurringExpense(long recurringExpenseId);
        Task<ServiceResponse<LoadRecurringExpenseDto>> GetRecurringExpenseById(long recurringExpenseId);
        Task<ServiceResponse<List<LoadRecurringExpenseDto>>> GetRecurringExpenses(long? propertyId = null, long? unitId = null);
        Task<ServiceResponse<LoadRecurringExpenseDto>> PauseRecurringExpense(long recurringExpenseId);
        Task<ServiceResponse<LoadRecurringExpenseDto>> ResumeRecurringExpense(long recurringExpenseId);
        Task<ServiceResponse<int>> GenerateExpensesFromRecurringTemplates();
    }
}
