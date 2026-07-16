import { HOUSEHOLD_ACTION_TYPES } from './household.types';

const initialState = {
  households: [],
  isLoading: false,
  error: null
};

function householdReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case HOUSEHOLD_ACTION_TYPES.GET_HOUSEHOLDS_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };
    case HOUSEHOLD_ACTION_TYPES.GET_HOUSEHOLDS_SUCCESS:
      return {
        ...state,
        isLoading: false,
        households: payload
      };
    case HOUSEHOLD_ACTION_TYPES.GET_HOUSEHOLDS_FAILED:
      return {
        ...state,
        isLoading: false,
        error: payload
      };
    default:
      return state;
  }
}

export default householdReducer;
