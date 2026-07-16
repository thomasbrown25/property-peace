using brownstone_hub_api.Dtos.ExpenseReceipt;

namespace brownstone_hub_api.Repositories.ExpenseReceipts
{
    public interface IExpenseReceiptRepository
    {
        Task<LoadExpenseReceiptDto> AddExpenseReceipt(AddExpenseReceiptDto expenseReceipt);
        Task<List<LoadExpenseReceiptDto>> GetExpenseReceiptsByExpenseId(long expenseId);
        Task<LoadExpenseReceiptDto> DeleteExpenseReceipt(long id);
    }
}

