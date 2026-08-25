import {
  getRecurringExpenses,
  getRecurringExpenseById,
  addRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  pauseRecurringExpense,
  resumeRecurringExpense
} from 'api/recurringExpense';
import { RECURRING_EXPENSE_ACTION_TYPES } from './recurring-expense.types';

let recurringExpenseListRequestSequence = 0;

const recurringExpenseRequestKey = (landlordId, filters) =>
  `recurring:${landlordId ?? 'unknown'}:${filters?.propertyId ?? filters?.PropertyId ?? 'all'}`;

export const getRecurringExpensesAction =
  (landlordId, filters = {}, suppliedRequestKey) =>
  async (dispatch) => {
    const requestId = ++recurringExpenseListRequestSequence;
    const requestKey = suppliedRequestKey || recurringExpenseRequestKey(landlordId, filters);
    const meta = { requestId, requestKey };
    try {
      dispatch({ type: RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSES_START, meta });

      const response = await getRecurringExpenses(landlordId, filters);

      // Handle ServiceResponse structure:
      // - response is the ServiceResponse object from the API
      // - response.data (or response.Data) contains the actual array
      // - Also handle case where response might be the array directly
      let recurringExpenses = [];
      if (Array.isArray(response)) {
        recurringExpenses = response;
      } else if (response?.data && Array.isArray(response.data)) {
        recurringExpenses = response.data;
      } else if (response?.Data && Array.isArray(response.Data)) {
        recurringExpenses = response.Data;
      }

      dispatch({
        type: RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSES_SUCCESS,
        payload: recurringExpenses,
        meta
      });
      return recurringExpenses;
    } catch (error) {
      dispatch({
        type: RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSES_FAILURE,
        payload: error?.response?.data?.errors || error.message,
        meta
      });
    }
  };

export const getRecurringExpenseByIdAction = (recurringExpenseId) => async (dispatch) => {
  try {
    dispatch({ type: RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSE_BY_ID_START });

    const response = await getRecurringExpenseById(recurringExpenseId);

    // Handle ServiceResponse structure: response.data is the ServiceResponse, response.data.data is the actual object
    const recurringExpense = response?.data || response;

    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSE_BY_ID_SUCCESS,
      payload: recurringExpense
    });
  } catch (error) {
    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSE_BY_ID_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
  }
};

export const addRecurringExpenseAction = (recurringExpense) => async (dispatch) => {
  try {
    console.log('[Action] addRecurringExpenseAction called with:', JSON.stringify(recurringExpense, null, 2));
    dispatch({ type: RECURRING_EXPENSE_ACTION_TYPES.ADD_RECURRING_EXPENSE_START });

    const response = await addRecurringExpense(recurringExpense);
    console.log('[Action] addRecurringExpense response:', response);

    // Handle ServiceResponse structure: response is the ServiceResponse, response.data is the actual object
    let newRecurringExpense;
    if (response?.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
      // response.data is the object
      newRecurringExpense = response.data;
    } else if (response?.Data && typeof response.Data === 'object' && !Array.isArray(response.Data)) {
      // response.Data is the object (capital D)
      newRecurringExpense = response.Data;
    } else {
      // response itself is the object
      newRecurringExpense = response;
    }

    console.log('[Action] Extracted recurring expense:', newRecurringExpense);

    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.ADD_RECURRING_EXPENSE_SUCCESS,
      payload: newRecurringExpense
    });

    return newRecurringExpense;
  } catch (error) {
    console.error('[Action] addRecurringExpenseAction error:', error);
    console.error('[Action] Error response:', error?.response?.data);
    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.ADD_RECURRING_EXPENSE_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const updateRecurringExpenseAction = (recurringExpenseId, recurringExpense) => async (dispatch) => {
  try {
    dispatch({ type: RECURRING_EXPENSE_ACTION_TYPES.UPDATE_RECURRING_EXPENSE_START });

    const response = await updateRecurringExpense(recurringExpenseId, recurringExpense);

    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.UPDATE_RECURRING_EXPENSE_SUCCESS,
      payload: response.data
    });

    return response.data;
  } catch (error) {
    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.UPDATE_RECURRING_EXPENSE_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const deleteRecurringExpenseAction = (recurringExpenseId) => async (dispatch) => {
  try {
    dispatch({ type: RECURRING_EXPENSE_ACTION_TYPES.DELETE_RECURRING_EXPENSE_START });

    await deleteRecurringExpense(recurringExpenseId);

    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.DELETE_RECURRING_EXPENSE_SUCCESS,
      payload: recurringExpenseId
    });
  } catch (error) {
    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.DELETE_RECURRING_EXPENSE_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const pauseRecurringExpenseAction = (recurringExpenseId) => async (dispatch) => {
  try {
    dispatch({ type: RECURRING_EXPENSE_ACTION_TYPES.PAUSE_RECURRING_EXPENSE_START });

    const response = await pauseRecurringExpense(recurringExpenseId);

    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.PAUSE_RECURRING_EXPENSE_SUCCESS,
      payload: response.data
    });

    return response.data;
  } catch (error) {
    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.PAUSE_RECURRING_EXPENSE_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const resumeRecurringExpenseAction = (recurringExpenseId) => async (dispatch) => {
  try {
    dispatch({ type: RECURRING_EXPENSE_ACTION_TYPES.RESUME_RECURRING_EXPENSE_START });

    const response = await resumeRecurringExpense(recurringExpenseId);

    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.RESUME_RECURRING_EXPENSE_SUCCESS,
      payload: response.data
    });

    return response.data;
  } catch (error) {
    dispatch({
      type: RECURRING_EXPENSE_ACTION_TYPES.RESUME_RECURRING_EXPENSE_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

// Synchronous actions
export const setSelectedRecurringExpense = (recurringExpense) => ({
  type: RECURRING_EXPENSE_ACTION_TYPES.SET_SELECTED_RECURRING_EXPENSE,
  payload: recurringExpense
});

export const setRecurringExpenseField = (name, value) => ({
  type: RECURRING_EXPENSE_ACTION_TYPES.SET_RECURRING_EXPENSE_FIELD,
  payload: { name, value }
});

export const resetRecurringExpenseState = () => ({
  type: RECURRING_EXPENSE_ACTION_TYPES.RESET_RECURRING_EXPENSE_STATE
});
