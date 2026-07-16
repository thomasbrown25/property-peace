using brownstone_hub_api.Dtos.ExpenseReceipt;

namespace brownstone_hub_api.Services.ExpenseReceiptService
{
    public interface IExpenseReceiptService
    {
        Task<ServiceResponse<List<LoadExpenseReceiptDto>>> AddExpenseReceipts(long expenseId, List<IFormFile> files);
        Task<ServiceResponse<List<LoadExpenseReceiptDto>>> GetExpenseReceipts(long expenseId);
        Task<ServiceResponse<LoadExpenseReceiptDto>> DeleteExpenseReceipt(long id);
    }
}

