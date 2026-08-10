using brownstone_hub_api.Dtos.Expense;

namespace brownstone_hub_api.Repositories.Expenses
{
    public interface IExpenseRepository
    {
        Task<LoadExpenseDto> AddExpense(AddExpenseDto expense, long organizationId);
        Task<LoadExpenseDto> UpdateExpense(UpdateExpenseDto expense, long organizationId);
        Task<bool> DeleteExpense(long expenseId, long organizationId);
        Task<LoadExpenseDto?> GetExpenseById(long expenseId, long organizationId);
        Task<List<LoadExpenseDto>> GetExpensesByLandlordId(long landlordId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null, string? category = null, long? vendorId = null, bool? isRecurring = null);
        Task<decimal> GetTotalExpensesByLandlordId(long landlordId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null);
        Task<List<LoadExpenseDto>> GetExpensesByOrganizationId(long organizationId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null, string? category = null, long? vendorId = null, long? unitId = null);
        Task<decimal> GetTotalExpensesByOrganizationId(long organizationId, long? propertyId = null, DateTime? startDate = null, DateTime? endDate = null);
        Task<List<LoadExpenseDto>> GetActiveRecurringExpensesDueToday();
        Task UpdateRecurringExpenseDates(long expenseId, DateTime lastGeneratedDate, DateTime? nextOccurrenceDate);
        Task<int> DeleteExpensesByPropertyId(long propertyId);
        Task<List<LoadExpenseDto>> GetUnpaidBills(long organizationId, string? filter = null);
        Task<bool> MarkBillAsPaid(long expenseId, long organizationId, DateTime paidDate);
    }
}

