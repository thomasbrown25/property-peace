import axiosServices from 'utils/axios';
import { MAINTENANCE_ACTION_TYPES } from './maintenance.types';
import { getDashboardSummary } from 'store/dashboard/dashboard.action';

export const setMaintenanceField = (name, value) => ({
  type: MAINTENANCE_ACTION_TYPES.SET_MAINTENANCE_FIELD,
  payload: { name, value }
});

export const setSelectedMaintenance = (maintenance) => ({
  type: MAINTENANCE_ACTION_TYPES.SET_SELECTED_MAINTENANCE,
  payload: maintenance
});

export const setMaintenanceImages = (images) => ({
  type: MAINTENANCE_ACTION_TYPES.SET_MAINTENANCE_IMAGES,
  payload: images
});

export const setMaintenanceIds = (ids) => ({
  type: MAINTENANCE_ACTION_TYPES.SET_MAINTENANCE_IDS,
  payload: ids
});

export const addMaintenance =
  (maintenance, imageFiles = []) =>
  async (dispatch) => {
    try {
      const formData = new FormData();
      formData.append('maintenanceData', JSON.stringify(maintenance));

      if (imageFiles && imageFiles.length > 0) {
        for (const image of imageFiles) {
          formData.append('files', image.file || image);
        }
      }

      const response = await axiosServices.post('/api/maintenance-request', formData);
      dispatch({
        type: MAINTENANCE_ACTION_TYPES.ADD_MAINTENANCE_SUCCESS,
        payload: response.data.data
      });
      dispatch(getDashboardSummary());
      return { success: true, data: response.data.data };
    } catch (error) {
      console.log(error, error.message);
      dispatch({
        type: MAINTENANCE_ACTION_TYPES.ADD_MAINTENANCE_FAILED,
        payload: error?.response?.data?.errors || error?.message
      });
      throw error; // Re-throw so calling code can handle it
    }
  };

export const addMaintenanceImages = (maintenanceId, imageFiles) => async (dispatch) => {
  try {
    const formData = new FormData();
    for (const file of imageFiles) {
      formData.append('files', file);
    }

    const response = await axiosServices.post(`/api/maintenanceimage/${maintenanceId}`, formData);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.ADD_MAINTENANCE_IMAGES_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.ADD_MAINTENANCE_IMAGES_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getMaintenances = (propertyId) => async (dispatch) => {
  try {
    const response = await axiosServices.get(`/api/maintenance-request/property/${propertyId}`);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const updateMaintenance = (maintenance) => async (dispatch) => {
  try {
    const response = await axiosServices.put(`/api/maintenance-request/${maintenance.id}`, maintenance);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.UPDATE_MAINTENANCE_SUCCESS,
      payload: response.data.data
    });
    dispatch(getDashboardSummary());
    return { success: true, data: response.data.data };
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.UPDATE_MAINTENANCE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error;
  }
};

export const deleteMaintenance = (maintenanceId) => async (dispatch) => {
  try {
    const response = await axiosServices.delete(`/api/maintenance-request/${maintenanceId}`);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.REMOVE_MAINTENANCE_SUCCESS,
      payload: response.data.data
    });
    dispatch(getDashboardSummary());
    return { success: true, data: response.data.data };
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.REMOVE_MAINTENANCE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error; // Re-throw so calling code can handle it
  }
};

export const removeMaintenanceImage = (imageId) => async (dispatch) => {
  try {
    const response = await axiosServices.delete(`/api/maintenanceimage/${imageId}`);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.REMOVE_MAINTENANCE_IMAGE_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.REMOVE_MAINTENANCE_IMAGE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getMaintenanceCategories = () => async (dispatch) => {
  try {
    const response = await axiosServices.get('/api/maintenance-request/categories');
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCE_CATEGORIES_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCE_CATEGORIES_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getMaintenanceImages = (maintenanceId) => async (dispatch) => {
  try {
    const response = await axiosServices.get(`/api/maintenanceimage/${maintenanceId}`);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCE_IMAGES_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCE_IMAGES_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getCurrentMaintenances = (propertyId) => async (dispatch) => {
  try {
    const response = await axiosServices.get(`/api/maintenance-request/property/${propertyId}/current`);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_CURRENT_MAINTENANCES_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_CURRENT_MAINTENANCES_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getHistoryMaintenances = (propertyId) => async (dispatch) => {
  try {
    const response = await axiosServices.get(`/api/maintenance-request/property/${propertyId}/history`);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_HISTORY_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_HISTORY_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getCurrentMaintenancesByOrganization = () => async (dispatch) => {
  try {
    // OrganizationId is sent via X-Organization-Id header
    const response = await axiosServices.get(`/api/maintenance-request/organization/current`);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const getHistoryMaintenancesByOrganization = () => async (dispatch) => {
  try {
    // OrganizationId is sent via X-Organization-Id header
    const response = await axiosServices.get(`/api/maintenance-request/organization/history`);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_HISTORY_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_HISTORY_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const reopenMaintenanceRequest = (maintenanceId) => async (dispatch) => {
  try {
    const response = await axiosServices.put(`/api/maintenance-request/reopen/${maintenanceId}`);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.REOPEN_MAINTENANCE_SUCCESS,
      payload: response.data.data
    });
    dispatch(getDashboardSummary());
    return { success: true, data: response.data.data };
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.REOPEN_MAINTENANCE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error; // Re-throw so calling code can handle it
  }
};

export const resolveMaintenanceRequest = (maintenanceId) => async (dispatch) => {
  try {
    const response = await axiosServices.put(`/api/maintenance-request/resolve/${maintenanceId}`);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.RESOLVE_MAINTENANCE_SUCCESS,
      payload: response.data.data
    });
    dispatch(getDashboardSummary());
    return { success: true, data: response.data.data };
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.RESOLVE_MAINTENANCE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error; // Re-throw so calling code can handle it
  }
};

export const analyzeMaintenanceRequest = (title, description) => async () => {
  try {
    const response = await axiosServices.post('/api/maintenance-request/analyze', {
      title: title || '',
      description: description || ''
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    console.log(error, error.message);
    return {
      success: false,
      message: error?.response?.data?.message || error?.message || 'Failed to analyze maintenance request',
      errors: error?.response?.data?.errors
    };
  }
};

export const assignMaintenance = (maintenanceId, assignmentData) => async (dispatch) => {
  try {
    const response = await axiosServices.put(`/api/maintenance-request/${maintenanceId}/assign`, assignmentData);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.ASSIGN_MAINTENANCE_SUCCESS,
      payload: response.data.data
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: MAINTENANCE_ACTION_TYPES.ASSIGN_MAINTENANCE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const generateTenantMessage = (maintenanceId) => async () => {
  try {
    const response = await axiosServices.post(`/api/maintenance-request/${maintenanceId}/generate-tenant-message`);
    return { success: true, data: response.data.data };
  } catch (error) {
    console.log(error, error.message);
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};