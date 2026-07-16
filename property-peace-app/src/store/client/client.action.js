import axiosServices from 'utils/axios';
import { CLIENT_ACTION_TYPES } from './client.types';

export const getClients = () => async (dispatch) => {
  try {
    dispatch({ type: CLIENT_ACTION_TYPES.GET_CLIENTS_START });

    const response = await axiosServices.get('/api/client');

    dispatch({
      type: CLIENT_ACTION_TYPES.GET_CLIENTS_SUCCESS,
      payload: response.data.data || []
    });
  } catch (error) {
    dispatch({
      type: CLIENT_ACTION_TYPES.GET_CLIENTS_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getClient = (clientId) => async (dispatch) => {
  try {
    dispatch({ type: CLIENT_ACTION_TYPES.GET_CLIENT_START });

    const response = await axiosServices.get(`/api/client/${clientId}`);

    dispatch({
      type: CLIENT_ACTION_TYPES.GET_CLIENT_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    dispatch({
      type: CLIENT_ACTION_TYPES.GET_CLIENT_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const addClient = (clientData) => async (dispatch) => {
  try {
    dispatch({ type: CLIENT_ACTION_TYPES.ADD_CLIENT_START });

    const response = await axiosServices.post('/api/client', clientData);

    dispatch({
      type: CLIENT_ACTION_TYPES.ADD_CLIENT_SUCCESS,
      payload: response.data.data
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    dispatch({
      type: CLIENT_ACTION_TYPES.ADD_CLIENT_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to create client'
    };
  }
};

export const updateClient = (clientId, clientData) => async (dispatch) => {
  try {
    dispatch({ type: CLIENT_ACTION_TYPES.UPDATE_CLIENT_START });

    const response = await axiosServices.put(`/api/client/${clientId}`, clientData);

    dispatch({
      type: CLIENT_ACTION_TYPES.UPDATE_CLIENT_SUCCESS,
      payload: response.data.data
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    dispatch({
      type: CLIENT_ACTION_TYPES.UPDATE_CLIENT_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to update client'
    };
  }
};

export const deleteClient = (clientId) => async (dispatch) => {
  try {
    dispatch({ type: CLIENT_ACTION_TYPES.DELETE_CLIENT_START });

    const response = await axiosServices.delete(`/api/client/${clientId}`);

    dispatch({
      type: CLIENT_ACTION_TYPES.DELETE_CLIENT_SUCCESS,
      payload: clientId
    });

    return { success: true };
  } catch (error) {
    dispatch({
      type: CLIENT_ACTION_TYPES.DELETE_CLIENT_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to delete client'
    };
  }
};

export const linkPropertyToClient = (clientId, propertyId) => async (dispatch) => {
  try {
    dispatch({ type: CLIENT_ACTION_TYPES.LINK_PROPERTY_START });

    const response = await axiosServices.post(`/api/client/${clientId}/link-property/${propertyId}`);

    dispatch({
      type: CLIENT_ACTION_TYPES.LINK_PROPERTY_SUCCESS,
      payload: { clientId, propertyId, data: response.data.data }
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    dispatch({
      type: CLIENT_ACTION_TYPES.LINK_PROPERTY_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to link property to client'
    };
  }
};

export const unlinkPropertyFromClient = (clientId, propertyId) => async (dispatch) => {
  try {
    dispatch({ type: CLIENT_ACTION_TYPES.UNLINK_PROPERTY_START });

    const response = await axiosServices.post(`/api/client/${clientId}/unlink-property/${propertyId}`);

    dispatch({
      type: CLIENT_ACTION_TYPES.UNLINK_PROPERTY_SUCCESS,
      payload: { clientId, propertyId, data: response.data.data }
    });

    return { success: true, data: response.data.data };
  } catch (error) {
    dispatch({
      type: CLIENT_ACTION_TYPES.UNLINK_PROPERTY_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });

    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to unlink property from client'
    };
  }
};

export const resetClientState = () => ({
  type: CLIENT_ACTION_TYPES.RESET_STATE
});
