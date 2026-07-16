import { RENT_COLLECTION_ACTION_TYPES } from './rent-collection.types';

const initialState = {
  // Current month data (lifetime=false)
  summary: null,
  rentRecords: [],
  // Lifetime data (lifetime=true)
  lifetimeSummary: null,
  lifetimeRentRecords: [],
  loading: false,
  error: null
};

function rentCollectionReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case RENT_COLLECTION_ACTION_TYPES.GET_RENT_COLLECTION_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case RENT_COLLECTION_ACTION_TYPES.GET_RENT_COLLECTION_SUCCESS:
      // Check if this is lifetime data based on payload flag or store it separately
      // We'll use a flag in the action to determine which data to store
      const isLifetime = payload?.isLifetime;
      if (isLifetime) {
        return {
          ...state,
          lifetimeSummary: payload?.summary,
          lifetimeRentRecords: payload?.rentRecords,
          loading: false,
          error: null
        };
      } else {
        return {
          ...state,
          summary: payload?.summary,
          rentRecords: payload?.rentRecords,
          loading: false,
          error: null
        };
      }

    case RENT_COLLECTION_ACTION_TYPES.GET_RENT_COLLECTION_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case RENT_COLLECTION_ACTION_TYPES.MAKE_PAYMENT_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case RENT_COLLECTION_ACTION_TYPES.MAKE_PAYMENT_SUCCESS:
      // Update the specific rent record in state
      const updatedRentRecords = state.rentRecords.map((rent) => (rent.id === payload.id ? payload : rent));
      return {
        ...state,
        rentRecords: updatedRentRecords,
        loading: false,
        error: null
      };

    case RENT_COLLECTION_ACTION_TYPES.MAKE_PAYMENT_FAILURE:
      return {
        ...state,
        loading: false,
        error: payload
      };

    default:
      return state;
  }
}
export default rentCollectionReducer;
