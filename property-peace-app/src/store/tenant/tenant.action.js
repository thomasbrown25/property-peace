import axiosServices from 'utils/axios';
import { TENANT_ACTION_TYPES } from './tenant.types';

export const setSelectedTenant = (tenant) => ({
  type: TENANT_ACTION_TYPES.SET_SELECTED_TENANT,
  payload: tenant
});

export const setTenantField = (name, value) => ({
  type: TENANT_ACTION_TYPES.SET_TENANT_FIELD,
  payload: { name, value }
});

export const addTenant = (tenant) => async (dispatch) => {
  try {
    const response = await axiosServices.post('/api/tenant', tenant);
    dispatch({
      type: TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.error(error);
    dispatch({
      type: TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const addOrUpdateTenant = (tenant) => async (dispatch) => {
  try {
    const response = await axiosServices.post('/api/tenant', tenant);
    dispatch({
      type: TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_SUCCESS,
      payload: response.data.data
    });
    //return response.data.data;
  } catch (error) {
    console.error(error);
    dispatch({
      type: TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    // Re-throw error so it can be caught in the form for email validation
    throw error;
  }
};

export const getTenants = (leaseId) => async (dispatch) => {
  try {
    const response = await axiosServices.get(`/api/tenant/lease/${leaseId}`);
    dispatch({
      type: TENANT_ACTION_TYPES.GET_TENANTS_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.error(error);
    dispatch({
      type: TENANT_ACTION_TYPES.GET_TENANTS_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

let _allTenantsFetchPending = false;

export const getAllTenants = () => async (dispatch) => {
  if (_allTenantsFetchPending) return;
  _allTenantsFetchPending = true;
  try {
    // OrganizationId is sent via X-Organization-Id header
    const response = await axiosServices.get(`/api/tenant/organization`);
    dispatch({
      type: TENANT_ACTION_TYPES.GET_ALL_TENANTS_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.error(error);
    dispatch({
      type: TENANT_ACTION_TYPES.GET_ALL_TENANTS_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  } finally {
    _allTenantsFetchPending = false;
  }
};

export const deleteTenant = (tenantId) => async (dispatch) => {
  try {
    await axiosServices.delete(`/api/tenant/${tenantId}`);
    dispatch({
      type: TENANT_ACTION_TYPES.DELETE_TENANT_SUCCESS,
      payload: tenantId
    });
  } catch (error) {
    console.error(error);
    dispatch({
      type: TENANT_ACTION_TYPES.DELETE_TENANT_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};
