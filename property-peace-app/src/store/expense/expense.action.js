import { expenseAPI } from 'api';
import { EXPENSE_ACTION_TYPES } from './expense.types';

export const getExpensesAction = (landlordId, filters = {}) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.GET_EXPENSES_START });
    
    const response = await expenseAPI.getExpenses(filters);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.GET_EXPENSES_SUCCESS,
      payload: response.data || []
    });
  } catch (error) {
    dispatch({
      type: EXPENSE_ACTION_TYPES.GET_EXPENSES_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
  }
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

export const addExpenseAction = (expense) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.ADD_EXPENSE_START });
    
    const response = await expenseAPI.addExpense(expense);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.ADD_EXPENSE_SUCCESS,
      payload: response.data
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

export const updateExpenseAction = (expenseId, expense) => async (dispatch) => {
  try {
    dispatch({ type: EXPENSE_ACTION_TYPES.UPDATE_EXPENSE_START });
    
    const response = await expenseAPI.updateExpense(expenseId, expense);
    
    dispatch({
      type: EXPENSE_ACTION_TYPES.UPDATE_EXPENSE_SUCCESS,
      payload: response.data
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

