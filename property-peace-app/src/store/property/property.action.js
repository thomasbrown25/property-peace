import axiosServices from 'utils/axios';
import { getActiveOrganizationId } from 'utils/impersonationSession';
import { PROPERTY_ACTION_TYPES } from './property.types';

export const setProperty = (property) => {
  return {
    type: PROPERTY_ACTION_TYPES.SET_PROPERTY,
    payload: property
  };
};

export const setSelectedProperty = (property) => {
  return {
    type: PROPERTY_ACTION_TYPES.SET_PROPERTY,
    payload: property
  };
};

export const setPropertyField = (name, value) => ({
  type: PROPERTY_ACTION_TYPES.SET_PROPERTY_FIELD,
  payload: { name, value }
});

export const setPropertyIds = (ids) => ({
  type: PROPERTY_ACTION_TYPES.SET_PROPERTY_IDS,
  payload: ids
});

export const addOrUpdateProperty =
  (propertyData, imageFiles = []) =>
  async (dispatch) => {
    try {
      const formData = new FormData();
      formData.append('propertyData', JSON.stringify(propertyData));

      if (imageFiles && imageFiles.length > 0) {
        for (const image of imageFiles) {
          formData.append('files', image.file || image);
        }
      }

      const response = await axiosServices.post('/api/property', formData);
      dispatch({
        type: PROPERTY_ACTION_TYPES.ADD_PROPERTY_SUCCESS,
        payload: response.data.data
      });

      return response.data.data;
    } catch (error) {
      console.log(error, error.message);
      dispatch({
        type: PROPERTY_ACTION_TYPES.ADD_PROPERTY_FAILED,
        payload: error?.response?.data?.errors || error?.message
      });
    }
  };

let _latestPropertiesRequestId = 0;

export const getProperties = (requestedOrganizationId = null) => async (dispatch, getState) => {
  const requestId = ++_latestPropertiesRequestId;
  const organizationId = requestedOrganizationId ?? getActiveOrganizationId(getState().auth?.user);
  try {
    dispatch({ type: PROPERTY_ACTION_TYPES.GET_PROPERTIES_START });
    // Pin the request to the organization selected when the refresh began.
    // Only the latest organization-scoped request may update the shared property store.
    const response = await axiosServices.get(`/api/property/list`, {
      headers: organizationId ? { 'X-Organization-Id': organizationId.toString() } : undefined
    });
    if (requestId !== _latestPropertiesRequestId) return { success: true, stale: true };

    dispatch({
      type: PROPERTY_ACTION_TYPES.GET_PROPERTIES_SUCCESS,
      payload: { properties: response.data.data, organizationId }
    });
    return { success: true };
  } catch (error) {
    if (requestId !== _latestPropertiesRequestId) return { success: false, stale: true };
    console.log(error, error.message);
    dispatch({
      type: PROPERTY_ACTION_TYPES.GET_PROPERTIES_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    return { success: false };
  }
};

export const getOccupiedCount = () => async (dispatch) => {
  try {
    // OrganizationId is sent via X-Organization-Id header
    const response = await axiosServices.get(`/api/property/occupied-count`);

    dispatch({
      type: PROPERTY_ACTION_TYPES.GET_OCCUPIED_COUNT_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: PROPERTY_ACTION_TYPES.GET_OCCUPIED_COUNT_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getVacantCount = () => async (dispatch) => {
  try {
    // OrganizationId is sent via X-Organization-Id header
    const response = await axiosServices.get(`/api/property/vacant-count`);

    dispatch({
      type: PROPERTY_ACTION_TYPES.GET_VACANT_COUNT_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: PROPERTY_ACTION_TYPES.GET_VACANT_COUNT_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getPropertyById = (propertyId) => async (dispatch) => {
  try {
    dispatch({ type: PROPERTY_ACTION_TYPES.GET_PROPERTY_START });
    const response = await axiosServices.get(`/api/property/${propertyId}`);

    dispatch({
      type: PROPERTY_ACTION_TYPES.GET_PROPERTY_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: PROPERTY_ACTION_TYPES.GET_PROPERTY_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const deleteProperty = (propertyId) => async (dispatch) => {
  try {
    const response = await axiosServices.delete(`/api/property/${propertyId}`);

    dispatch({
      type: PROPERTY_ACTION_TYPES.DELETE_PROPERTY_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: PROPERTY_ACTION_TYPES.DELETE_PROPERTY_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const inactivateProperty = (propertyId) => async (dispatch) => {
  try {
    const response = await axiosServices.put(`/api/property/${propertyId}/inactivate`);

    dispatch({
      type: PROPERTY_ACTION_TYPES.DELETE_PROPERTY_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: PROPERTY_ACTION_TYPES.DELETE_PROPERTY_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error;
  }
};

export const reactivateProperty = (propertyId) => async (dispatch) => {
  try {
    const response = await axiosServices.put(`/api/property/${propertyId}/reactivate`);

    dispatch({
      type: PROPERTY_ACTION_TYPES.DELETE_PROPERTY_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: PROPERTY_ACTION_TYPES.DELETE_PROPERTY_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error;
  }
};

export const isSingleUnitPortfolio = () => async (dispatch) => {
  try {
    // OrganizationId is sent via X-Organization-Id header
    const response = await axiosServices.get(`/api/property/is-single-unit-portfolio`);
    dispatch({
      type: PROPERTY_ACTION_TYPES.IS_SINGLE_UNIT_PORTFOLIO_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: PROPERTY_ACTION_TYPES.IS_SINGLE_UNIT_PORTFOLIO_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const addPropertyImages = (propertyId, imageFiles) => async (dispatch) => {
  try {
    const formData = new FormData();
    for (const file of imageFiles) {
      formData.append('files', file);
    }

    const response = await axiosServices.post(`/api/propertyimage/${propertyId}`, formData);
    
    // Refresh the property to get updated images
    await dispatch(getPropertyById(propertyId));
    
    return response.data.data;
  } catch (error) {
    console.log(error, error.message);
    throw error;
  }
};