using brownstone_hub_api.Dtos.Expense;

namespace brownstone_hub_api.Services.ExpenseService
{
    public interface IExpenseService
    {
        Task<ServiceResponse<LoadExpenseDto>> AddExpense(AddExpenseDto expense);
        Task<ServiceResponse<LoadExpenseDto>> UpdateExpense(UpdateExpenseDto expense);
        Task<ServiceResponse<bool>> DeleteExpense(long expenseId);
        Task<ServiceResponse<LoadExpenseDto>> GetExpenseById(long expenseId);
        Task<ServiceResponse<List<LoadExpenseDto>>> GetExpenses(long organizationId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null, string? category = null);
        Task<ServiceResponse<decimal>> GetTotalExpenses(long organizationId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<bool>> GenerateExpensesFromRecurring();
        Task<ServiceResponse<LoadExpenseDto>> PauseRecurringExpense(long expenseId);
        Task<ServiceResponse<LoadExpenseDto>> ResumeRecurringExpense(long expenseId);
        Task<ServiceResponse<List<LoadExpenseDto>>> GetUnpaidBillsAsync(string? filter = null);
        Task<ServiceResponse<bool>> MarkBillAsPaidAsync(long expenseId, DateTime paidDate);
    }
}

