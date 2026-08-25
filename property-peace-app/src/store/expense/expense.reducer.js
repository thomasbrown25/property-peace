import { EXPENSE_ACTION_TYPES } from './expense.types';

const initialState = {
  expenses: [], // Each expense contains a receipts array
  selectedExpense: null,
  totalAmount: 0,
  listLoading: false,
  listError: null,
  listRequestId: null,
  listRequestKey: null,
  listSettledRequestKey: null,
  loading: false,
  error: null
};

function expenseReducer(state = initialState, action) {
  const { type, payload, meta } = action;

  switch (type) {
    // GET_EXPENSES cases
    case EXPENSE_ACTION_TYPES.GET_EXPENSES_START:
      return {
        ...state,
        listLoading: true,
        listError: null,
        listRequestId: meta?.requestId ?? null,
        listRequestKey: meta?.requestKey ?? null,
        loading: true,
        error: null
      };

    case EXPENSE_ACTION_TYPES.GET_EXPENSES_SUCCESS:
      if (meta?.requestId !== undefined && state.listRequestId !== meta.requestId) return state;
      return {
        ...state,
        expenses: payload,
        listLoading: false,
        listError: null,
        listSettledRequestKey: meta?.requestKey ?? state.listRequestKey,
        loading: false,
        error: null
      };

    case EXPENSE_ACTION_TYPES.GET_EXPENSES_FAILURE:
      if (meta?.requestId !== undefined && state.listRequestId !== meta.requestId) return state;
      return {
        ...state,
        expenses: [],
        listLoading: false,
        listError: payload,
        listSettledRequestKey: meta?.requestKey ?? state.listRequestKey,
        loading: false,
        error: payload
      };

    // GET_EXPENSE_BY_ID cases
    case EXPENSE_ACTION_TYPES.GET_EXPENSE_BY_ID_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case EXPENSE_ACTION_TYPES.GET_EXPENSE_BY_ID_SUCCESS:
      return {
        ...state,
        selectedExpense: payload,
        loading: false,
        error: null
      };

    case EXPENSE_ACTION_TYPES.GET_EXPENSE_BY_ID_FAILURE:
      return {
        ...state,
        selectedExpense: null,
        loading: false,
        error: payload
      };

    // GET_TOTAL_EXPENSES cases
    case EXPENSE_ACTION_TYPES.GET_TOTAL_EXPENSES_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case EXPENSE_ACTION_TYPES.GET_TOTAL_EXPENSES_SUCCESS:
      return {
        ...state,
        totalAmount: payload,
        loading: false,
        error: null
      };

    case EXPENSE_ACTION_TYPES.GET_TOTAL_EXPENSES_FAILURE:
      return {
        ...state,
        totalAmount: 0,
        loading: false,
        error: payload
      };

    // ADD_EXPENSE cases
    case EXPENSE_ACTION_TYPES.ADD_EXPENSE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case EXPENSE_ACTION_TYPES.ADD_EXPENSE_SUCCESS:
      return {
        ...state,
        expenses: [...state.expenses, payload],
        selectedExpense: payload,
        loading: false,
        error: null
      };

    case EXPENSE_ACTION_TYPES.ADD_EXPENSE_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // UPDATE_EXPENSE cases
    case EXPENSE_ACTION_TYPES.UPDATE_EXPENSE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case EXPENSE_ACTION_TYPES.UPDATE_EXPENSE_SUCCESS:
      // Preserve existing receipts if payload doesn't include them
      const updatedExpense = payload.receipts ? payload : {
        ...payload,
        receipts: state.expenses.find(e => e.id === payload.id)?.receipts || []
      };
      
      return {
        ...state,
        expenses: state.expenses.map((expense) =>
          expense.id === payload.id ? updatedExpense : expense
        ),
        selectedExpense: updatedExpense,
        loading: false,
        error: null
      };

    case EXPENSE_ACTION_TYPES.UPDATE_EXPENSE_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // DELETE_EXPENSE cases
    case EXPENSE_ACTION_TYPES.DELETE_EXPENSE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case EXPENSE_ACTION_TYPES.DELETE_EXPENSE_SUCCESS:
      return {
        ...state,
        expenses: state.expenses.filter((expense) => expense.id !== payload),
        selectedExpense: state.selectedExpense?.id === payload ? null : state.selectedExpense,
        loading: false,
        error: null
      };

    case EXPENSE_ACTION_TYPES.DELETE_EXPENSE_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // UPLOAD_EXPENSE_RECEIPTS cases
    case EXPENSE_ACTION_TYPES.UPLOAD_EXPENSE_RECEIPTS_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case EXPENSE_ACTION_TYPES.UPLOAD_EXPENSE_RECEIPTS_SUCCESS:
      // Merge new receipts with existing ones (backend returns only newly uploaded receipts)
      const existingReceiptIds = new Set();
      return {
        ...state,
        expenses: state.expenses.map((expense) => {
          if (expense.id === payload.expenseId) {
            // Track existing receipt IDs to avoid duplicates
            const existingIds = (expense.receipts || []).map(r => r.id);
            existingReceiptIds.clear();
            existingIds.forEach(id => existingReceiptIds.add(id));
            
            // Merge new receipts with existing ones, avoiding duplicates
            const newReceipts = (payload.receipts || []).filter(r => !existingReceiptIds.has(r.id));
            return { ...expense, receipts: [...(expense.receipts || []), ...newReceipts] };
          }
          return expense;
        }),
        selectedExpense:
          state.selectedExpense?.id === payload.expenseId
            ? (() => {
                const existingIds = new Set((state.selectedExpense.receipts || []).map(r => r.id));
                const newReceipts = (payload.receipts || []).filter(r => !existingIds.has(r.id));
                return { ...state.selectedExpense, receipts: [...(state.selectedExpense.receipts || []), ...newReceipts] };
              })()
            : state.selectedExpense,
        loading: false,
        error: null
      };

    case EXPENSE_ACTION_TYPES.UPLOAD_EXPENSE_RECEIPTS_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // GET_EXPENSE_RECEIPTS cases
    case EXPENSE_ACTION_TYPES.GET_EXPENSE_RECEIPTS_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case EXPENSE_ACTION_TYPES.GET_EXPENSE_RECEIPTS_SUCCESS:
      // Update receipts within the expense object
      return {
        ...state,
        expenses: state.expenses.map((expense) =>
          expense.id === payload.expenseId
            ? { ...expense, receipts: payload.receipts }
            : expense
        ),
        selectedExpense:
          state.selectedExpense?.id === payload.expenseId
            ? { ...state.selectedExpense, receipts: payload.receipts }
            : state.selectedExpense,
        loading: false,
        error: null
      };

    case EXPENSE_ACTION_TYPES.GET_EXPENSE_RECEIPTS_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // DELETE_EXPENSE_RECEIPT cases
    case EXPENSE_ACTION_TYPES.DELETE_EXPENSE_RECEIPT_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case EXPENSE_ACTION_TYPES.DELETE_EXPENSE_RECEIPT_SUCCESS:
      // Remove receipt from the expense's receipts array
      return {
        ...state,
        expenses: state.expenses.map((expense) =>
          expense.receipts?.some((receipt) => receipt.id === payload)
            ? {
                ...expense,
                receipts: expense.receipts.filter((receipt) => receipt.id !== payload)
              }
            : expense
        ),
        selectedExpense:
          state.selectedExpense?.receipts?.some((receipt) => receipt.id === payload)
            ? {
                ...state.selectedExpense,
                receipts: state.selectedExpense.receipts.filter((receipt) => receipt.id !== payload)
              }
            : state.selectedExpense,
        loading: false,
        error: null
      };

    case EXPENSE_ACTION_TYPES.DELETE_EXPENSE_RECEIPT_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    // State management cases
    case EXPENSE_ACTION_TYPES.SET_SELECTED_EXPENSE:
      return {
        ...state,
        selectedExpense: payload,
        error: null
      };

    case EXPENSE_ACTION_TYPES.SET_EXPENSE_FIELD:
      return {
        ...state,
        selectedExpense: {
          ...state.selectedExpense,
          [payload.name]: payload.value
        },
        error: null
      };

    case EXPENSE_ACTION_TYPES.RESET_EXPENSE_STATE:
      return initialState;

    default:
      return state;
  }
}

export default expenseReducer;

