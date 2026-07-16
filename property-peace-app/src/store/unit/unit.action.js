import axiosServices from 'utils/axios';
import { UNIT_ACTION_TYPES } from './unit.types';

export const setUnit = (unit) => ({
  type: UNIT_ACTION_TYPES.SET_UNIT,
  payload: unit
});

export const setUnits = (units) => ({
  type: UNIT_ACTION_TYPES.SET_UNITS,
  payload: units
});

export const setUnitIds = (unitIds) => ({
  type: UNIT_ACTION_TYPES.SET_UNIT_IDS,
  payload: unitIds
});

export const setUnitField = (name, value) => ({
  type: UNIT_ACTION_TYPES.SET_UNIT_FIELD,
  payload: { name, value }
});

export const addOrUpdateUnit = (unit) => async (dispatch) => {
  try {
    const response = await axiosServices.post(`/api/unit`, unit);
    dispatch({
      type: UNIT_ACTION_TYPES.ADD_UNIT_SUCCESS,
      payload: response.data.data
    });
    return response.data.data;
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: UNIT_ACTION_TYPES.ADD_UNIT_FAILED,
      payload: error?.response?.data?.errors
    });
  }
};

export const getUnits = (propertyId) => async (dispatch) => {
  try {
    const response = await axiosServices.get(`/api/unit/${propertyId}`);

    dispatch({
      type: UNIT_ACTION_TYPES.GET_UNITS_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: UNIT_ACTION_TYPES.GET_UNITS_FAILED,
      payload: error?.response?.data?.errors
    });
  }
};

export const deleteUnit = (unitId) => async (dispatch) => {
  try {
    const response = await axiosServices.delete(`/api/unit/${unitId}`);
    dispatch({
      type: UNIT_ACTION_TYPES.DELETE_UNIT_SUCCESS,
      payload: unitId
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: UNIT_ACTION_TYPES.DELETE_UNIT_FAILED,
      payload: error?.response?.data?.errors
    });
    throw error;
  }
};

export const bulkCreateUnits = (propertyId, units) => async (dispatch) => {
  try {
    dispatch({
      type: UNIT_ACTION_TYPES.BULK_CREATE_UNITS_START
    });

    const response = await axiosServices.post('/api/unit/bulk', {
      propertyId,
      units
    });

    dispatch({
      type: UNIT_ACTION_TYPES.BULK_CREATE_UNITS_SUCCESS,
      payload: response.data.data
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: UNIT_ACTION_TYPES.BULK_CREATE_UNITS_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error;
  }
};