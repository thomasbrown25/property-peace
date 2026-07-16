export const selectRecurringExpenses = (state) => state.recurringExpense?.recurringExpenses || [];
export const selectSelectedRecurringExpense = (state) => state.recurringExpense?.selectedRecurringExpense || null;
export const selectRecurringExpenseLoading = (state) => state.recurringExpense?.loading || false;
export const selectRecurringExpenseError = (state) => state.recurringExpense?.error || null;
