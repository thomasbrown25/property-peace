import axiosServices from 'utils/axios';
import { PROPERTY_OWNER_ACTION_TYPES } from './property-owner.types';

export const getPropertyOwners = () => async (dispatch) => {
  try {
    dispatch({ type: PROPERTY_OWNER_ACTION_TYPES.GET_OWNERS_START });

    const response = await axiosServices.get('/api/propertyowner');

    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.GET_OWNERS_SUCCESS,
      payload: response.data.data || []
    });
  } catch (error) {
    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.GET_OWNERS_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getPropertyOwner = (ownerId) => async (dispatch) => {
  try {
    dispatch({ type: PROPERTY_OWNER_ACTION_TYPES.GET_OWNER_START });

    const response = await axiosServices.get(`/api/propertyowner/${ownerId}`);

    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.GET_OWNER_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.GET_OWNER_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const addPropertyOwner = (ownerData) => async (dispatch) => {
  try {
    dispatch({ type: PROPERTY_OWNER_ACTION_TYPES.ADD_OWNER_START });

    const response = await axiosServices.post('/api/propertyowner', ownerData);

    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.ADD_OWNER_SUCCESS,
      payload: response.data.data
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.ADD_OWNER_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to create property owner'
    };
  }
};

export const updatePropertyOwner = (ownerId, ownerData) => async (dispatch) => {
  try {
    dispatch({ type: PROPERTY_OWNER_ACTION_TYPES.UPDATE_OWNER_START });

    const response = await axiosServices.put(`/api/propertyowner/${ownerId}`, ownerData);

    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.UPDATE_OWNER_SUCCESS,
      payload: response.data.data
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.UPDATE_OWNER_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to update property owner'
    };
  }
};

export const deletePropertyOwner = (ownerId) => async (dispatch) => {
  try {
    dispatch({ type: PROPERTY_OWNER_ACTION_TYPES.DELETE_OWNER_START });

    const response = await axiosServices.delete(`/api/propertyowner/${ownerId}`);

    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.DELETE_OWNER_SUCCESS,
      payload: ownerId
    });

    return { success: true };
  } catch (error) {
    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.DELETE_OWNER_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to delete property owner'
    };
  }
};

export const linkPropertyToOwner = (ownerId, propertyId) => async (dispatch) => {
  try {
    dispatch({ type: PROPERTY_OWNER_ACTION_TYPES.LINK_PROPERTY_START });

    const response = await axiosServices.post(`/api/propertyowner/${ownerId}/link-property/${propertyId}`);

    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.LINK_PROPERTY_SUCCESS,
      payload: { ownerId, propertyId, data: response.data.data }
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.LINK_PROPERTY_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to link property to owner'
    };
  }
};

export const unlinkPropertyFromOwner = (ownerId, propertyId) => async (dispatch) => {
  try {
    dispatch({ type: PROPERTY_OWNER_ACTION_TYPES.UNLINK_PROPERTY_START });

    const response = await axiosServices.post(`/api/propertyowner/${ownerId}/unlink-property/${propertyId}`);

    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.UNLINK_PROPERTY_SUCCESS,
      payload: { ownerId, propertyId, data: response.data.data }
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    dispatch({
      type: PROPERTY_OWNER_ACTION_TYPES.UNLINK_PROPERTY_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to unlink property from owner'
    };
  }
};

export const resetPropertyOwnerState = () => ({
  type: PROPERTY_OWNER_ACTION_TYPES.RESET_STATE
});
