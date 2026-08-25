export const selectFutureExpenses = (state) => state.futureExpense?.futureExpenses || [];
export const selectFutureExpenseListLoading = (state) => state.futureExpense?.listLoading || false;
export const selectFutureExpenseListError = (state) => state.futureExpense?.listError || null;
export const selectFutureExpenseListRequestKey = (state) => state.futureExpense?.listRequestKey || null;
export const selectFutureExpenseListSettledRequestKey = (state) => state.futureExpense?.listSettledRequestKey || null;
export const selectFutureExpenseCleanupById = (state) => state.futureExpense?.recordedExpenseCleanupById || {};
