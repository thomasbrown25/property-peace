import { FUTURE_EXPENSE_ACTION_TYPES } from './future-expense.types';

const initialState = {
  futureExpenses: [],
  recordedExpenseCleanupById: {},
  cleanupHydratedIdentity: null,
  listLoading: false,
  listError: null,
  listRequestId: null,
  listRequestKey: null,
  listSettledRequestKey: null,
  mutationLoading: false,
  mutationError: null,
  loading: false,
  error: null
};

function legacyFutureExpenseReducer(state = initialState, action) {
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
        futureExpenses: state.futureExpenses.filter((exp) => exp.id !== action.payload),
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

const listSuccessType = FUTURE_EXPENSE_ACTION_TYPES.GET_FUTURE_EXPENSES_SUCCESS;
const listFailureType = FUTURE_EXPENSE_ACTION_TYPES.GET_FUTURE_EXPENSES_FAILURE;
const mutationStartTypes = new Set([
  FUTURE_EXPENSE_ACTION_TYPES.ADD_FUTURE_EXPENSE_START,
  FUTURE_EXPENSE_ACTION_TYPES.DELETE_FUTURE_EXPENSE_START
]);
const mutationSuccessTypes = new Set([
  FUTURE_EXPENSE_ACTION_TYPES.ADD_FUTURE_EXPENSE_SUCCESS,
  FUTURE_EXPENSE_ACTION_TYPES.DELETE_FUTURE_EXPENSE_SUCCESS
]);
const mutationFailureTypes = new Set([
  FUTURE_EXPENSE_ACTION_TYPES.ADD_FUTURE_EXPENSE_FAILURE,
  FUTURE_EXPENSE_ACTION_TYPES.DELETE_FUTURE_EXPENSE_FAILURE
]);
const futureExpenseId = (expense) => expense?.id ?? expense?.Id;

const keepMarkersForExpenses = (markers, expenses, meta) => {
  const presentIds = new Set((expenses || []).map((expense) => String(futureExpenseId(expense))));
  return Object.fromEntries(
    Object.entries(markers || {}).filter(([id, marker]) => {
      if (meta?.landlordId == null && meta?.organizationId == null) return presentIds.has(String(id));
      if (meta?.landlordId != null && (marker?.landlordId == null || String(marker.landlordId) !== String(meta.landlordId))) {
        return true;
      }
      if (
        meta?.organizationId != null &&
        (marker?.organizationId == null || String(marker.organizationId) !== String(meta.organizationId))
      ) {
        return true;
      }
      if (meta?.propertyId != null) {
        if (marker.propertyId == null || String(marker.propertyId) !== String(meta.propertyId)) return true;
      }
      return presentIds.has(String(id));
    })
  );
};

const isCurrentListCompletion = (state, action) => {
  if (action.meta?.requestId == null) return true;
  return state.listRequestId === action.meta.requestId && state.listRequestKey === action.meta.requestKey;
};

function futureExpenseReducer(state = initialState, action) {
  if ((action.type === listSuccessType || action.type === listFailureType) && !isCurrentListCompletion(state, action)) {
    return state;
  }

  const nextState = legacyFutureExpenseReducer(state, action);

  if (action.type === FUTURE_EXPENSE_ACTION_TYPES.GET_FUTURE_EXPENSES_START) {
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
      recordedExpenseCleanupById: keepMarkersForExpenses(state.recordedExpenseCleanupById, nextState.futureExpenses, action.meta),
      listLoading: false,
      listError: null,
      listRequestId: null,
      listSettledRequestKey: action.meta?.requestKey ?? state.listRequestKey
    };
  }

  if (action.type === listFailureType) {
    return {
      ...nextState,
      futureExpenses: [],
      listLoading: false,
      listError: action.payload,
      listRequestId: null,
      listSettledRequestKey: action.meta?.requestKey ?? state.listRequestKey
    };
  }

  if (action.type === FUTURE_EXPENSE_ACTION_TYPES.HYDRATE_FUTURE_EXPENSE_CLEANUP) {
    const landlordId = action.payload?.landlordId;
    const organizationId = action.payload?.organizationId;
    return {
      ...nextState,
      futureExpenses: [],
      recordedExpenseCleanupById: action.payload?.markers || {},
      cleanupHydratedIdentity:
        landlordId == null || organizationId == null ? null : { landlordId: String(landlordId), organizationId: String(organizationId) },
      listLoading: false,
      listError: null,
      listRequestId: null,
      listRequestKey: null,
      listSettledRequestKey: null
    };
  }

  if (action.type === FUTURE_EXPENSE_ACTION_TYPES.MARK_FUTURE_EXPENSE_CLEANUP_PENDING) {
    return {
      ...nextState,
      recordedExpenseCleanupById: {
        ...state.recordedExpenseCleanupById,
        [String(action.payload.futureExpenseId)]: action.payload.marker
      }
    };
  }

  if (action.type === FUTURE_EXPENSE_ACTION_TYPES.CLEAR_FUTURE_EXPENSE_CLEANUP_PENDING) {
    const recordedExpenseCleanupById = { ...state.recordedExpenseCleanupById };
    delete recordedExpenseCleanupById[String(action.payload)];
    return { ...nextState, recordedExpenseCleanupById };
  }

  if (mutationStartTypes.has(action.type)) {
    return {
      ...nextState,
      mutationLoading: true,
      mutationError: null
    };
  }

  if (mutationSuccessTypes.has(action.type)) {
    const mutationState = {
      ...nextState,
      mutationLoading: false,
      mutationError: null,
      listLoading: false,
      listRequestId: null,
      listSettledRequestKey: state.listRequestKey ?? state.listSettledRequestKey
    };
    if (action.type !== FUTURE_EXPENSE_ACTION_TYPES.DELETE_FUTURE_EXPENSE_SUCCESS) {
      return mutationState;
    }

    const recordedExpenseCleanupById = { ...state.recordedExpenseCleanupById };
    delete recordedExpenseCleanupById[String(action.payload)];
    return {
      ...mutationState,
      futureExpenses: state.futureExpenses.filter((expense) => String(futureExpenseId(expense)) !== String(action.payload)),
      recordedExpenseCleanupById
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

export default futureExpenseReducer;
