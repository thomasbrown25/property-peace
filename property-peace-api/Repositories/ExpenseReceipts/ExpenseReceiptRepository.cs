using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.ExpenseReceipt;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.ExpenseReceipts
{
    public class ExpenseReceiptRepository(DataContext context, IMapper mapper) : IExpenseReceiptRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadExpenseReceiptDto> AddExpenseReceipt(AddExpenseReceiptDto expenseReceipt)
        {
            var newExpenseReceipt = _mapper.Map<ExpenseReceipt>(expenseReceipt);
            await _context.ExpenseReceipts.AddAsync(newExpenseReceipt);
            await _context.SaveChangesAsync();

            return _mapper.Map<LoadExpenseReceiptDto>(newExpenseReceipt);
        }

        public async Task<List<LoadExpenseReceiptDto>> GetExpenseReceiptsByExpenseId(long expenseId)
        {
            var receipts = await _context.ExpenseReceipts
                .Where(x => x.RefId == expenseId)
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync();

            return _mapper.Map<List<LoadExpenseReceiptDto>>(receipts);
        }

        public async Task<LoadExpenseReceiptDto> DeleteExpenseReceipt(long id)
        {
            var receipt = await _context.ExpenseReceipts.FindAsync(id) 
                ?? throw new KeyNotFoundException($"Expense receipt with ID {id} not found.");

            _context.ExpenseReceipts.Remove(receipt);
            await _context.SaveChangesAsync();

            return _mapper.Map<LoadExpenseReceiptDto>(receipt);
        }
    }
}

