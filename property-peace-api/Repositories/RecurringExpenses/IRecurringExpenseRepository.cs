using brownstone_hub_api.Dtos.RecurringExpense;

namespace brownstone_hub_api.Repositories.RecurringExpenses
{
    public interface IRecurringExpenseRepository
    {
        Task<LoadRecurringExpenseDto> AddRecurringExpense(AddRecurringExpenseDto recurringExpense, long? organizationId = null);
        Task<LoadRecurringExpenseDto> UpdateRecurringExpense(UpdateRecurringExpenseDto recurringExpense);
        Task<bool> DeleteRecurringExpense(long recurringExpenseId);
        Task<LoadRecurringExpenseDto?> GetRecurringExpenseById(long recurringExpenseId);
        Task<List<LoadRecurringExpenseDto>> GetRecurringExpensesByLandlordId(long landlordId, long? propertyId = null);
        Task<List<LoadRecurringExpenseDto>> GetRecurringExpensesByOrganizationId(long organizationId, long? propertyId = null);
        Task<List<LoadRecurringExpenseDto>> GetActiveRecurringExpenses();
        Task<List<LoadRecurringExpenseDto>> GetRecurringExpensesDueForGeneration(DateTime? beforeDate = null);
        Task UpdateLastGeneratedDate(long recurringExpenseId, DateTime generatedDate);
        Task<int> DeleteRecurringExpensesByPropertyId(long propertyId);
    }
}
