import { getFutureExpenses, getFutureExpenseById, addFutureExpense, deleteFutureExpense } from 'api/futureExpense';
import { FUTURE_EXPENSE_ACTION_TYPES } from './future-expense.types';

let futureExpenseListRequestSequence = 0;

const futureExpenseRequestKey = (landlordId, filters) =>
  `future:${landlordId ?? 'unknown'}:${filters?.propertyId ?? filters?.PropertyId ?? 'all'}`;

export const getFutureExpensesAction =
  (landlordId, filters = {}, suppliedRequestKey) =>
  async (dispatch) => {
    const requestId = ++futureExpenseListRequestSequence;
    const requestKey = suppliedRequestKey || futureExpenseRequestKey(landlordId, filters);
    const meta = { requestId, requestKey };
    try {
      dispatch({ type: FUTURE_EXPENSE_ACTION_TYPES.GET_FUTURE_EXPENSES_START, meta });

      const response = await getFutureExpenses(landlordId, filters);

      // Handle ServiceResponse structure: response is the ServiceResponse, response.data is the array
      let futureExpenses = [];
      if (Array.isArray(response)) {
        futureExpenses = response;
      } else if (response?.data && Array.isArray(response.data)) {
        futureExpenses = response.data;
      } else if (response?.Data && Array.isArray(response.Data)) {
        futureExpenses = response.Data;
      }

      dispatch({
        type: FUTURE_EXPENSE_ACTION_TYPES.GET_FUTURE_EXPENSES_SUCCESS,
        payload: Array.isArray(futureExpenses) ? futureExpenses : [],
        meta
      });
      return futureExpenses;
    } catch (error) {
      dispatch({
        type: FUTURE_EXPENSE_ACTION_TYPES.GET_FUTURE_EXPENSES_FAILURE,
        payload: error?.response?.data?.errors || error.message,
        meta
      });
    }
  };

export const addFutureExpenseAction = (futureExpense) => async (dispatch) => {
  try {
    dispatch({ type: FUTURE_EXPENSE_ACTION_TYPES.ADD_FUTURE_EXPENSE_START });

    const response = await addFutureExpense(futureExpense);

    // Handle ServiceResponse structure
    let newFutureExpense;
    if (response?.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
      newFutureExpense = response.data;
    } else if (response?.Data && typeof response.Data === 'object' && !Array.isArray(response.Data)) {
      newFutureExpense = response.Data;
    } else {
      newFutureExpense = response;
    }

    dispatch({
      type: FUTURE_EXPENSE_ACTION_TYPES.ADD_FUTURE_EXPENSE_SUCCESS,
      payload: newFutureExpense
    });

    return newFutureExpense;
  } catch (error) {
    dispatch({
      type: FUTURE_EXPENSE_ACTION_TYPES.ADD_FUTURE_EXPENSE_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const deleteFutureExpenseAction = (futureExpenseId) => async (dispatch) => {
  try {
    dispatch({ type: FUTURE_EXPENSE_ACTION_TYPES.DELETE_FUTURE_EXPENSE_START });

    await deleteFutureExpense(futureExpenseId);

    dispatch({
      type: FUTURE_EXPENSE_ACTION_TYPES.DELETE_FUTURE_EXPENSE_SUCCESS,
      payload: futureExpenseId
    });
  } catch (error) {
    dispatch({
      type: FUTURE_EXPENSE_ACTION_TYPES.DELETE_FUTURE_EXPENSE_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    throw error;
  }
};

export const markFutureExpenseCleanupPendingAction = (futureExpenseId, marker) => ({
  type: FUTURE_EXPENSE_ACTION_TYPES.MARK_FUTURE_EXPENSE_CLEANUP_PENDING,
  payload: { futureExpenseId, marker }
});

export const clearFutureExpenseCleanupPendingAction = (futureExpenseId) => ({
  type: FUTURE_EXPENSE_ACTION_TYPES.CLEAR_FUTURE_EXPENSE_CLEANUP_PENDING,
  payload: futureExpenseId
});
