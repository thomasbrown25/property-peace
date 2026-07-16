import axiosServices from 'utils/axios';
import { DASHBOARD_ACTION_TYPES } from './dashboard.types';

export const getDashboardSummary = () => {
  return async (dispatch) => {
    try {
      dispatch({ type: DASHBOARD_ACTION_TYPES.GET_DASHBOARD_SUMMARY_START });
      
      // OrganizationId is sent via X-Organization-Id header
      const response = await axiosServices.get(`/api/dashboard/summary`);
      dispatch({
        type: DASHBOARD_ACTION_TYPES.GET_DASHBOARD_SUMMARY_SUCCESS,
        payload: response.data.data
      });
    } catch (error) {
      dispatch({
        type: DASHBOARD_ACTION_TYPES.GET_DASHBOARD_SUMMARY_FAILED,
        payload: error.message
      });
    }
  };
};
