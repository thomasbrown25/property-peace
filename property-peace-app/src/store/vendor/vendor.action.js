import axiosServices from 'utils/axios';
import { VENDOR_ACTION_TYPES } from './vendor.types';

export const getVendors = (landlordId, includeInactive = false) => async (dispatch) => {
  try {
    dispatch({ type: VENDOR_ACTION_TYPES.GET_VENDORS_START });

    const response = await axiosServices.get('/api/vendor', {
      params: {
        landlordId,
        includeInactive
      }
    });

    dispatch({
      type: VENDOR_ACTION_TYPES.GET_VENDORS_SUCCESS,
      payload: response.data.data || []
    });
  } catch (error) {
    dispatch({
      type: VENDOR_ACTION_TYPES.GET_VENDORS_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getVendor = (vendorId) => async (dispatch) => {
  try {
    dispatch({ type: VENDOR_ACTION_TYPES.GET_VENDOR_START });

    const response = await axiosServices.get(`/api/vendor/${vendorId}`);

    dispatch({
      type: VENDOR_ACTION_TYPES.GET_VENDOR_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    dispatch({
      type: VENDOR_ACTION_TYPES.GET_VENDOR_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const addVendor = (vendorData) => async (dispatch) => {
  try {
    dispatch({ type: VENDOR_ACTION_TYPES.ADD_VENDOR_START });

    const response = await axiosServices.post('/api/vendor', vendorData);

    dispatch({
      type: VENDOR_ACTION_TYPES.ADD_VENDOR_SUCCESS,
      payload: response.data.data
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    dispatch({
      type: VENDOR_ACTION_TYPES.ADD_VENDOR_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to create vendor'
    };
  }
};

export const updateVendor = (vendorId, vendorData) => async (dispatch) => {
  try {
    dispatch({ type: VENDOR_ACTION_TYPES.UPDATE_VENDOR_START });

    const response = await axiosServices.put(`/api/vendor/${vendorId}`, vendorData);

    dispatch({
      type: VENDOR_ACTION_TYPES.UPDATE_VENDOR_SUCCESS,
      payload: response.data.data
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    dispatch({
      type: VENDOR_ACTION_TYPES.UPDATE_VENDOR_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to update vendor'
    };
  }
};

export const deleteVendor = (vendorId, softDelete = true) => async (dispatch) => {
  try {
    dispatch({ type: VENDOR_ACTION_TYPES.DELETE_VENDOR_START });

    const response = await axiosServices.delete(`/api/vendor/${vendorId}`, {
      params: { softDelete }
    });

    dispatch({
      type: VENDOR_ACTION_TYPES.DELETE_VENDOR_SUCCESS,
      payload: vendorId
    });

    return { success: true };
  } catch (error) {
    dispatch({
      type: VENDOR_ACTION_TYPES.DELETE_VENDOR_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to delete vendor'
    };
  }
};

export const searchVendors = (landlordId, searchTerm, category = null) => async (dispatch) => {
  try {
    dispatch({ type: VENDOR_ACTION_TYPES.SEARCH_VENDORS_START });

    const params = { landlordId, q: searchTerm };
    if (category) {
      params.category = category;
    }

    const response = await axiosServices.get('/api/vendor/search', { params });

    dispatch({
      type: VENDOR_ACTION_TYPES.SEARCH_VENDORS_SUCCESS,
      payload: response.data.data || []
    });
  } catch (error) {
    dispatch({
      type: VENDOR_ACTION_TYPES.SEARCH_VENDORS_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const resetVendorState = () => ({
  type: VENDOR_ACTION_TYPES.RESET_STATE
});

