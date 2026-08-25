import { expenseAPI } from 'api';
import { buildExpenseListRequestKey } from 'utils/expensesTab';
import { EXPENSE_ACTION_TYPES } from './expense.types';

let expenseListRequestSequence = 0;

export const registerExpenseListScopeAction = (requestKey) => ({
  type: EXPENSE_ACTION_TYPES.REGISTER_EXPENSE_LIST_SCOPE,
  meta: { requestKey }
});

export const releaseExpenseListScopeAction = (requestKey) => ({
  type: EXPENSE_ACTION_TYPES.RELEASE_EXPENSE_LIST_SCOPE,
  meta: { requestKey }
});

export const invalidateExpenseListsAction = () => ({
  type: EXPENSE_ACTION_TYPES.INVALIDATE_EXPENSE_LISTS
});

export const getExpensesAction = (landlordId, filters = {}, suppliedRequestKey) => async (dispatch) => {
  const requestId = ++expenseListRequestSequence;
  const requestKey = suppliedRequestKey ?? buildExpenseListRequestKey(landlordId, filters);
  const meta = { requestId, requestKey };

  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.GET_EXPENSES_START, meta });
    
    const response = await expenseAPI.getExpenses(filters);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.GET_EXPENSES_SUCCESS,
      payload: response.data || [],
      meta
    });
  } catch (error) {
    dispatch({
      type: EXPENSE_ACTION_TYPES.GET_EXPENSES_FAILURE,
      payload: error?.response?.data?.errors || error.message,
      meta
    });
  }
};

export const getRegisteredExpensesAction = (landlordId, filters = {}, suppliedRequestKey) => (dispatch, getState) => {
  const requestKey = suppliedRequestKey ?? buildExpenseListRequestKey(landlordId, filters);
  const expenseState = getState()?.expense;
  const registered = (expenseState?.listRequestRefCounts?.[requestKey] || 0) > 0;
  const loading = Boolean(expenseState?.listRequestsByKey?.[requestKey]?.loading);
  if (!registered || loading) return null;

  return dispatch(getExpensesAction(landlordId, filters, requestKey));
};

export const getStaleExpensesAction = (landlordId, filters = {}, suppliedRequestKey) => (dispatch, getState) => {
  const requestKey = suppliedRequestKey ?? buildExpenseListRequestKey(landlordId, filters);
  const expenseState = getState()?.expense;
  const request = expenseState?.listRequestsByKey?.[requestKey];
  if (!(expenseState?.listRequestRefCounts?.[requestKey] > 0) || !request?.stale || request.loading) return null;

  return dispatch(getExpensesAction(landlordId, filters, requestKey));
};
export const getExpenseByIdAction = (expenseId) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.GET_EXPENSE_BY_ID_START });
    
    const response = await expenseAPI.getExpenseById(expenseId);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.GET_EXPENSE_BY_ID_SUCCESS,
      payload: response.data
    });
  } catch (error) {
    dispatch({
      type: EXPENSE_ACTION_TYPES.GET_EXPENSE_BY_ID_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
  }
};

export const getTotalExpensesAction = (landlordId, filters = {}) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.GET_TOTAL_EXPENSES_START });
    
    const response = await expenseAPI.getTotalExpenses(filters);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.GET_TOTAL_EXPENSES_SUCCESS,
      payload: response.data || 0
    });
  } catch (error) {
    dispatch({
      type: EXPENSE_ACTION_TYPES.GET_TOTAL_EXPENSES_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
  }
};

export const addExpenseAction = (expense, { invalidateLists = true } = {}) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.ADD_EXPENSE_START });
    
    const response = await expenseAPI.addExpense(expense);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.ADD_EXPENSE_SUCCESS,
      payload: response.data,
      meta: { invalidateLists }
    });
    
    return response.data;
  } catch (error) {
    dispatch({
      type: EXPENSE_ACTION_TYPES.ADD_EXPENSE_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const updateExpenseAction = (expenseId, expense, { invalidateLists = true } = {}) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.UPDATE_EXPENSE_START });
    
    const response = await expenseAPI.updateExpense(expenseId, expense);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.UPDATE_EXPENSE_SUCCESS,
      payload: response.data,
      meta: { invalidateLists }
    });
    
    return response.data;
  } catch (error) {
    dispatch({
      type: EXPENSE_ACTION_TYPES.UPDATE_EXPENSE_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const runCompositeExpenseMutation = async (dispatch, operation) => {
  let coreMutationCommitted = false;
  const commitCoreMutation = async (mutationAction) => {
    const result = await dispatch(mutationAction);
    coreMutationCommitted = true;
    return result;
  };

  try {
    return await operation(commitCoreMutation);
  } finally {
    if (coreMutationCommitted) dispatch(invalidateExpenseListsAction());
  }
};

export const deleteExpenseAction = (expenseId) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.DELETE_EXPENSE_START });
    
    await expenseAPI.deleteExpense(expenseId);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.DELETE_EXPENSE_SUCCESS,
      payload: expenseId
    });
  } catch (error) {
    dispatch({
      type: EXPENSE_ACTION_TYPES.DELETE_EXPENSE_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const uploadExpenseReceiptsAction = (expenseId, files) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.UPLOAD_EXPENSE_RECEIPTS_START });
    
    const response = await expenseAPI.uploadExpenseReceipts(expenseId, files);
    
    // Response format from API: response = { success, message, data: [...] }
    // The API function returns response.data, which is the full response object
    const receipts = response?.data || response?.Data || [];
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.UPLOAD_EXPENSE_RECEIPTS_SUCCESS,
      payload: { expenseId, receipts }
    });
    
    return receipts;
  } catch (error) {
    dispatch({
      type: EXPENSE_ACTION_TYPES.UPLOAD_EXPENSE_RECEIPTS_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const createExpenseWithReceipts = async ({ commitCoreMutation, dispatch, createAction, receiptFiles = [] }) => {
  const expense = await commitCoreMutation(createAction);
  const expenseId = expense?.id ?? expense?.Id ?? expense?.data?.id ?? expense?.data?.Id;
  const files = Array.isArray(receiptFiles) ? receiptFiles : [];
  if (files.length === 0) return { status: 'created', expense, expenseId };
  const retryReceipt = () => {
    if (!expenseId)
      return Promise.reject(new Error('The expense was created, but its receipt cannot be uploaded because the record ID is unavailable.'));
    return dispatch(uploadExpenseReceiptsAction(expenseId, files));
  };
  try {
    await retryReceipt();
    return { status: 'created', expense, expenseId };
  } catch (receiptError) {
    return {
      status: 'created-without-receipts',
      expense,
      expenseId,
      receiptError,
      retryReceipt
    };
  }
};

export const getExpenseReceiptsAction = (expenseId) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.GET_EXPENSE_RECEIPTS_START });
    
    const response = await expenseAPI.getExpenseReceipts(expenseId);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.GET_EXPENSE_RECEIPTS_SUCCESS,
      payload: { expenseId, receipts: response.data || [] }
    });
    
    return response.data;
  } catch (error) {
    dispatch({
      type: EXPENSE_ACTION_TYPES.GET_EXPENSE_RECEIPTS_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const deleteExpenseReceiptAction = (receiptId) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.DELETE_EXPENSE_RECEIPT_START });
    
    await expenseAPI.deleteExpenseReceipt(receiptId);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.DELETE_EXPENSE_RECEIPT_SUCCESS,
      payload: receiptId
    });
  } catch (error) {
    dispatch({
      type: EXPENSE_ACTION_TYPES.DELETE_EXPENSE_RECEIPT_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

// Synchronous actions
export const setSelectedExpense = (expense) => ({
  type: EXPENSE_ACTION_TYPES.SET_SELECTED_EXPENSE,
  payload: expense
});

export const setExpenseField = (name, value) => ({
  type: EXPENSE_ACTION_TYPES.SET_EXPENSE_FIELD,
  payload: { name, value }
});

export const resetExpenseState = () => ({
  type: EXPENSE_ACTION_TYPES.RESET_EXPENSE_STATE
});

