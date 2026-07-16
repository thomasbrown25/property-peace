import { DASHBOARD_ACTION_TYPES } from './dashboard.types';

const initialState = {
  summary: null,
  loading: true,
  error: null
};

function dashboardReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case DASHBOARD_ACTION_TYPES.GET_DASHBOARD_SUMMARY_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case DASHBOARD_ACTION_TYPES.GET_DASHBOARD_SUMMARY_SUCCESS:
      return {
        ...state,
        summary: payload,
        loading: false,
        error: null
      };
    case DASHBOARD_ACTION_TYPES.GET_DASHBOARD_SUMMARY_FAILED:
      return {
        ...state,
        summary: null,
        loading: false,
        error: payload
      };
    default:
      return state;
  }
}

export default dashboardReducer;
