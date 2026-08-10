using brownstone_hub_api.Dtos.RecurringExpense;

namespace brownstone_hub_api.Repositories.RecurringExpenses
{
    public interface IRecurringExpenseRepository
    {
        Task<LoadRecurringExpenseDto> AddRecurringExpense(AddRecurringExpenseDto recurringExpense, long organizationId);
        Task<LoadRecurringExpenseDto> UpdateRecurringExpense(UpdateRecurringExpenseDto recurringExpense, long organizationId);
        Task<bool> DeleteRecurringExpense(long recurringExpenseId, long organizationId);
        Task<LoadRecurringExpenseDto?> GetRecurringExpenseById(long recurringExpenseId, long organizationId);
        Task<List<LoadRecurringExpenseDto>> GetRecurringExpensesByOrganizationId(long organizationId, long? propertyId = null, long? unitId = null);
        Task<List<LoadRecurringExpenseDto>> GetActiveRecurringExpenses();
        Task<List<LoadRecurringExpenseDto>> GetRecurringExpensesDueForGeneration(DateTime? beforeDate = null);
        Task UpdateLastGeneratedDate(long recurringExpenseId, DateTime generatedDate);
        Task<int> DeleteRecurringExpensesByPropertyId(long propertyId);
    }
}
