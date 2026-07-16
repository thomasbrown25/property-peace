import { PAYMENT_ACTION_TYPES } from './payment.types';

const initialState = {
  payments: [],
  allPayments: [],
  allPaymentsLoadedAt: null,
  loading: false,
  error: null
};

function paymentReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case PAYMENT_ACTION_TYPES.GET_PAYMENTS_SUCCESS:
      return {
        ...state,
        payments: payload,
        loading: false,
        error: null
      };

    case PAYMENT_ACTION_TYPES.GET_PAYMENTS_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case PAYMENT_ACTION_TYPES.ADD_PAYMENT_SUCCESS:
      return {
        ...state,
        payments: [...state.payments, payload],
        loading: false,
        error: null
      };

    case PAYMENT_ACTION_TYPES.GET_ALL_PAYMENTS_SUCCESS:
      return {
        ...state,
        allPayments: payload,
        allPaymentsLoadedAt: Date.now(),
        loading: false,
        error: null
      };

    case PAYMENT_ACTION_TYPES.GET_ALL_PAYMENTS_FAILURE:
      return {
        ...state,
        allPaymentsLoadedAt: Date.now(),
        loading: false,
        error: payload
      };

    case PAYMENT_ACTION_TYPES.ADD_PAYMENT_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    default:
      return state;
  }
}
export default paymentReducer;
