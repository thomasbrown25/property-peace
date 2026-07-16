export const selectExpenses = (state) => state.expense?.expenses || [];
export const selectSelectedExpense = (state) => state.expense?.selectedExpense;
export const selectTotalExpenses = (state) => state.expense?.totalAmount || 0;
export const selectExpenseLoading = (state) => state.expense?.loading || false;
export const selectExpenseError = (state) => state.expense?.error;
// Get receipts from within the expense object
export const selectExpenseReceipts = (state, expenseId) => {
  const expense = state.expense?.expenses?.find(e => e.id === expenseId);
  return expense?.receipts || [];
};
// Get receipts from selected expense
export const selectSelectedExpenseReceipts = (state) => 
  state.expense?.selectedExpense?.receipts || [];

