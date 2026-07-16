import axiosServices from 'utils/axios';
import { HOUSEHOLD_ACTION_TYPES } from './household.types';

export const getHouseholds = (landlordId) => async (dispatch) => {
  try {
    if (!landlordId) {
      console.warn('couldnt fetch households, landlordId is required');
      return;
    }

    dispatch({ type: HOUSEHOLD_ACTION_TYPES.GET_HOUSEHOLDS_START });

    const response = await axiosServices.get(`/household/landlord/${landlordId}`);
    dispatch({
      type: HOUSEHOLD_ACTION_TYPES.GET_HOUSEHOLDS_SUCCESS,
      payload: response.data
    });
  } catch (error) {
    dispatch({
      type: HOUSEHOLD_ACTION_TYPES.GET_HOUSEHOLDS_FAILED,
      payload: error.message
    });
  }
};

export const updateHouseholdAsync = (landlordId, householdData) => async (dispatch) => {
  try {
    dispatch({ type: HOUSEHOLD_ACTION_TYPES.UPDATE_HOUSEHOLD_START });

    const response = await axiosServices.put(`/household/landlord/${landlordId}`, householdData);
    dispatch({
      type: HOUSEHOLD_ACTION_TYPES.UPDATE_HOUSEHOLD_SUCCESS,
      payload: response.data
    });
    return response.data;
  } catch (error) {
    dispatch({
      type: HOUSEHOLD_ACTION_TYPES.UPDATE_HOUSEHOLD_FAILED,
      payload: error.message
    });
  }
};
