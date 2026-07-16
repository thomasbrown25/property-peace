import { RECURRING_EXPENSE_ACTION_TYPES } from './recurring-expense.types';

const initialState = {
  recurringExpenses: [],
  selectedRecurringExpense: null,
  loading: false,
  error: null
};

function recurringExpenseReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    // GET_RECURRING_EXPENSES cases
    case RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSES_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSES_SUCCESS:
      return {
        ...state,
        recurringExpenses: payload,
        loading: false,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSES_FAILURE:
      return {
        ...state,
        recurringExpenses: [],
        loading: false,
        error: payload
      };

    // GET_RECURRING_EXPENSE_BY_ID cases
    case RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSE_BY_ID_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSE_BY_ID_SUCCESS:
      return {
        ...state,
        selectedRecurringExpense: payload,
        loading: false,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSE_BY_ID_FAILURE:
      return {
        ...state,
        selectedRecurringExpense: null,
        loading: false,
        error: payload
      };

    // ADD_RECURRING_EXPENSE cases
    case RECURRING_EXPENSE_ACTION_TYPES.ADD_RECURRING_EXPENSE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.ADD_RECURRING_EXPENSE_SUCCESS:
      return {
        ...state,
        recurringExpenses: [...state.recurringExpenses, payload],
        selectedRecurringExpense: payload,
        loading: false,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.ADD_RECURRING_EXPENSE_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // UPDATE_RECURRING_EXPENSE cases
    case RECURRING_EXPENSE_ACTION_TYPES.UPDATE_RECURRING_EXPENSE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.UPDATE_RECURRING_EXPENSE_SUCCESS:
      return {
        ...state,
        recurringExpenses: state.recurringExpenses.map((re) =>
          re.id === payload.id ? payload : re
        ),
        selectedRecurringExpense: payload,
        loading: false,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.UPDATE_RECURRING_EXPENSE_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // DELETE_RECURRING_EXPENSE cases
    case RECURRING_EXPENSE_ACTION_TYPES.DELETE_RECURRING_EXPENSE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.DELETE_RECURRING_EXPENSE_SUCCESS:
      return {
        ...state,
        recurringExpenses: state.recurringExpenses.filter((re) => re.id !== payload),
        selectedRecurringExpense: state.selectedRecurringExpense?.id === payload ? null : state.selectedRecurringExpense,
        loading: false,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.DELETE_RECURRING_EXPENSE_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // PAUSE_RECURRING_EXPENSE cases
    case RECURRING_EXPENSE_ACTION_TYPES.PAUSE_RECURRING_EXPENSE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.PAUSE_RECURRING_EXPENSE_SUCCESS:
      return {
        ...state,
        recurringExpenses: state.recurringExpenses.map((re) =>
          re.id === payload.id ? payload : re
        ),
        selectedRecurringExpense: state.selectedRecurringExpense?.id === payload.id ? payload : state.selectedRecurringExpense,
        loading: false,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.PAUSE_RECURRING_EXPENSE_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // RESUME_RECURRING_EXPENSE cases
    case RECURRING_EXPENSE_ACTION_TYPES.RESUME_RECURRING_EXPENSE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.RESUME_RECURRING_EXPENSE_SUCCESS:
      return {
        ...state,
        recurringExpenses: state.recurringExpenses.map((re) =>
          re.id === payload.id ? payload : re
        ),
        selectedRecurringExpense: state.selectedRecurringExpense?.id === payload.id ? payload : state.selectedRecurringExpense,
        loading: false,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.RESUME_RECURRING_EXPENSE_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // State management cases
    case RECURRING_EXPENSE_ACTION_TYPES.SET_SELECTED_RECURRING_EXPENSE:
      return {
        ...state,
        selectedRecurringExpense: payload,
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.SET_RECURRING_EXPENSE_FIELD:
      return {
        ...state,
        selectedRecurringExpense: {
          ...state.selectedRecurringExpense,
          [payload.name]: payload.value
        },
        error: null
      };

    case RECURRING_EXPENSE_ACTION_TYPES.RESET_RECURRING_EXPENSE_STATE:
      return initialState;

    default:
      return state;
  }
}

export default recurringExpenseReducer;
