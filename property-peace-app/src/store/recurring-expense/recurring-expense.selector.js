export const selectRecurringExpenses = (state) => state.recurringExpense?.recurringExpenses || [];
export const selectSelectedRecurringExpense = (state) => state.recurringExpense?.selectedRecurringExpense || null;
export const selectRecurringExpenseLoading = (state) => state.recurringExpense?.loading || false;
export const selectRecurringExpenseError = (state) => state.recurringExpense?.error || null;
export const selectRecurringExpenseListLoading = (state) => state.recurringExpense?.listLoading || false;
export const selectRecurringExpenseListError = (state) => state.recurringExpense?.listError || null;
export const selectRecurringExpenseListRequestKey = (state) => state.recurringExpense?.listRequestKey || null;
export const selectRecurringExpenseListSettledRequestKey = (state) => state.recurringExpense?.listSettledRequestKey || null;
