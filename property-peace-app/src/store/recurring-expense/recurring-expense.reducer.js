import { RECURRING_EXPENSE_ACTION_TYPES } from './recurring-expense.types';

const initialState = {
  recurringExpenses: [],
  selectedRecurringExpense: null,
  loading: false,
  listLoading: false,
  listError: null,
  listRequestId: null,
  listRequestKey: null,
  listSettledRequestKey: null,
  mutationLoading: false,
  mutationError: null,
  error: null
};

const listSuccessType = RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSES_SUCCESS;
const listFailureType = RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSES_FAILURE;
const mutationStartTypes = new Set([
  RECURRING_EXPENSE_ACTION_TYPES.ADD_RECURRING_EXPENSE_START,
  RECURRING_EXPENSE_ACTION_TYPES.UPDATE_RECURRING_EXPENSE_START,
  RECURRING_EXPENSE_ACTION_TYPES.DELETE_RECURRING_EXPENSE_START,
  RECURRING_EXPENSE_ACTION_TYPES.PAUSE_RECURRING_EXPENSE_START,
  RECURRING_EXPENSE_ACTION_TYPES.RESUME_RECURRING_EXPENSE_START
]);
const mutationSuccessTypes = new Set([
  RECURRING_EXPENSE_ACTION_TYPES.ADD_RECURRING_EXPENSE_SUCCESS,
  RECURRING_EXPENSE_ACTION_TYPES.UPDATE_RECURRING_EXPENSE_SUCCESS,
  RECURRING_EXPENSE_ACTION_TYPES.DELETE_RECURRING_EXPENSE_SUCCESS,
  RECURRING_EXPENSE_ACTION_TYPES.PAUSE_RECURRING_EXPENSE_SUCCESS,
  RECURRING_EXPENSE_ACTION_TYPES.RESUME_RECURRING_EXPENSE_SUCCESS
]);
const mutationFailureTypes = new Set([
  RECURRING_EXPENSE_ACTION_TYPES.ADD_RECURRING_EXPENSE_FAILURE,
  RECURRING_EXPENSE_ACTION_TYPES.UPDATE_RECURRING_EXPENSE_FAILURE,
  RECURRING_EXPENSE_ACTION_TYPES.DELETE_RECURRING_EXPENSE_FAILURE,
  RECURRING_EXPENSE_ACTION_TYPES.PAUSE_RECURRING_EXPENSE_FAILURE,
  RECURRING_EXPENSE_ACTION_TYPES.RESUME_RECURRING_EXPENSE_FAILURE
]);

function legacyRecurringExpenseReducer(state = initialState, action) {
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
        recurringExpenses: state.recurringExpenses.map((re) => (re.id === payload.id ? payload : re)),
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
        recurringExpenses: state.recurringExpenses.map((re) => (re.id === payload.id ? payload : re)),
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
        recurringExpenses: state.recurringExpenses.map((re) => (re.id === payload.id ? payload : re)),
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

const isCurrentListCompletion = (state, action) => {
  if (action.meta?.requestId == null) return true;
  return state.listRequestId === action.meta.requestId && state.listRequestKey === action.meta.requestKey;
};

function recurringExpenseReducer(state = initialState, action) {
  if ((action.type === listSuccessType || action.type === listFailureType) && !isCurrentListCompletion(state, action)) {
    return state;
  }

  const nextState = legacyRecurringExpenseReducer(state, action);

  if (action.type === RECURRING_EXPENSE_ACTION_TYPES.GET_RECURRING_EXPENSES_START) {
    return {
      ...nextState,
      listLoading: true,
      listError: null,
      listRequestId: action.meta?.requestId ?? null,
      listRequestKey: action.meta?.requestKey ?? null
    };
  }

  if (action.type === listSuccessType) {
    return {
      ...nextState,
      listLoading: false,
      listError: null,
      listRequestId: null,
      listSettledRequestKey: action.meta?.requestKey ?? state.listRequestKey
    };
  }

  if (action.type === listFailureType) {
    return {
      ...nextState,
      listLoading: false,
      listError: action.payload,
      listRequestId: null,
      listSettledRequestKey: action.meta?.requestKey ?? state.listRequestKey
    };
  }

  if (mutationStartTypes.has(action.type)) {
    return {
      ...nextState,
      mutationLoading: true,
      mutationError: null
    };
  }

  if (mutationSuccessTypes.has(action.type)) {
    return {
      ...nextState,
      mutationLoading: false,
      mutationError: null,
      listLoading: false,
      listRequestId: null,
      listSettledRequestKey: state.listRequestKey ?? state.listSettledRequestKey
    };
  }

  if (mutationFailureTypes.has(action.type)) {
    return {
      ...nextState,
      mutationLoading: false,
      mutationError: action.payload
    };
  }

  return nextState;
}

export default recurringExpenseReducer;
