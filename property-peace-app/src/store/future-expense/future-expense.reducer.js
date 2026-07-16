import { FUTURE_EXPENSE_ACTION_TYPES } from './future-expense.types';

const initialState = {
  futureExpenses: [],
  loading: false,
  error: null
};

function futureExpenseReducer(state = initialState, action) {
  switch (action.type) {
    case FUTURE_EXPENSE_ACTION_TYPES.GET_FUTURE_EXPENSES_START:
    case FUTURE_EXPENSE_ACTION_TYPES.ADD_FUTURE_EXPENSE_START:
    case FUTURE_EXPENSE_ACTION_TYPES.DELETE_FUTURE_EXPENSE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case FUTURE_EXPENSE_ACTION_TYPES.GET_FUTURE_EXPENSES_SUCCESS:
      return {
        ...state,
        futureExpenses: action.payload || [],
        loading: false,
        error: null
      };

    case FUTURE_EXPENSE_ACTION_TYPES.ADD_FUTURE_EXPENSE_SUCCESS:
      return {
        ...state,
        futureExpenses: [...state.futureExpenses, action.payload],
        loading: false,
        error: null
      };

    case FUTURE_EXPENSE_ACTION_TYPES.DELETE_FUTURE_EXPENSE_SUCCESS:
      return {
        ...state,
        futureExpenses: state.futureExpenses.filter(exp => exp.id !== action.payload),
        loading: false,
        error: null
      };

    case FUTURE_EXPENSE_ACTION_TYPES.GET_FUTURE_EXPENSES_FAILURE:
    case FUTURE_EXPENSE_ACTION_TYPES.ADD_FUTURE_EXPENSE_FAILURE:
    case FUTURE_EXPENSE_ACTION_TYPES.DELETE_FUTURE_EXPENSE_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };

    default:
      return state;
  }
}

export default futureExpenseReducer;
