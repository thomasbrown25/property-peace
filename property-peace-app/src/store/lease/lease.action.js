import axiosServices from 'utils/axios';
import { LEASE_ACTION_TYPES } from './lease.types';

export const setLeaseField = (name, value) => ({
  type: LEASE_ACTION_TYPES.SET_LEASE_FIELD,
  payload: { name, value }
});

export const setLease = (lease) => ({
  type: LEASE_ACTION_TYPES.SET_LEASE,
  payload: lease
});

export const addOrUpdateLease = (lease) => async (dispatch) => {
  try {
    const response = await axiosServices.post('/api/lease', lease);
    dispatch({
      type: LEASE_ACTION_TYPES.ADD_LEASE_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.error(error);
    dispatch({
      type: LEASE_ACTION_TYPES.ADD_LEASE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const updateLease = (lease) => {
  return async (dispatch) => {
    try {
      console.log('updateLease action called with:', lease);
      const response = await axiosServices.post(`/api/lease`, lease);
      console.log('updateLease API response:', response);
      console.log('updateLease response.data:', response?.data);
      
      // Ensure response and response.data exist
      if (!response || !response.data) {
        const errorMessage = 'Invalid response from server';
        dispatch({
          type: LEASE_ACTION_TYPES.UPDATE_LEASE_FAILED,
          payload: errorMessage
        });
        return { success: false, message: errorMessage };
      }
      
      // Check if the API response indicates success
      if (response.data.success === true) {
        dispatch({
          type: LEASE_ACTION_TYPES.UPDATE_LEASE_SUCCESS,
          payload: response.data.data || response.data
        });
        const result = { success: true, data: response.data.data || response.data };
        console.log('updateLease returning success:', result);
        return result;
      } else {
        // API returned but with success: false
        const errorMessage = response.data?.message || 'Failed to update lease';
        dispatch({
          type: LEASE_ACTION_TYPES.UPDATE_LEASE_FAILED,
          payload: response.data?.errors || errorMessage
        });
        const result = { success: false, message: errorMessage };
        console.log('updateLease returning failure:', result);
        return result;
      }
    } catch (error) {
      console.error('Error in updateLease action:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update lease';
      dispatch({
        type: LEASE_ACTION_TYPES.UPDATE_LEASE_FAILED,
        payload: error?.response?.data?.errors || errorMessage
      });
      const result = { success: false, message: errorMessage };
      console.log('updateLease returning error:', result);
      return result;
    }
  };
};

export const getLease = (unitId) => async (dispatch) => {
  try {
    const response = await axiosServices.get(`/api/lease/${unitId}`);
    dispatch({
      type: LEASE_ACTION_TYPES.GET_LEASE_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.error(error);
    dispatch({
      type: LEASE_ACTION_TYPES.GET_LEASE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
  }
};

export const deleteLease = (leaseId) => async (dispatch) => {
  try {
    const response = await axiosServices.delete(`/api/lease/${leaseId}`);
    dispatch({
      type: LEASE_ACTION_TYPES.DELETE_LEASE_SUCCESS,
      payload: leaseId
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    console.error(error);
    dispatch({
      type: LEASE_ACTION_TYPES.DELETE_LEASE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error;
  }
};

export const sendLeaseForSignature = (leaseId, signatureRequest) => async (dispatch) => {
  try {
    dispatch({ type: LEASE_ACTION_TYPES.SEND_LEASE_FOR_SIGNATURE_START });
    const response = await axiosServices.post(`/api/Lease/${leaseId}/send-for-signature`, signatureRequest);
    
    if (response.data.success) {
      dispatch({
        type: LEASE_ACTION_TYPES.SEND_LEASE_FOR_SIGNATURE_SUCCESS,
        payload: {
          leaseId,
          signatureData: response.data.data || {}
        }
      });
      return { success: true, data: response.data.data };
    } else {
      dispatch({
        type: LEASE_ACTION_TYPES.SEND_LEASE_FOR_SIGNATURE_FAILED,
        payload: response.data.message || 'Failed to send lease for signature'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: LEASE_ACTION_TYPES.SEND_LEASE_FOR_SIGNATURE_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error sending lease for signature'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const getLeaseSignatureStatus = (leaseId) => async (dispatch) => {
  try {
    dispatch({ type: LEASE_ACTION_TYPES.GET_LEASE_SIGNATURE_STATUS_START });
    const response = await axiosServices.get(`/api/Lease/${leaseId}/signature-status`);
    
    if (response.data.success) {
      dispatch({
        type: LEASE_ACTION_TYPES.GET_LEASE_SIGNATURE_STATUS_SUCCESS,
        payload: {
          leaseId,
          signatureData: response.data.data || {}
        }
      });
      return { success: true, data: response.data.data };
    } else {
      dispatch({
        type: LEASE_ACTION_TYPES.GET_LEASE_SIGNATURE_STATUS_FAILED,
        payload: response.data.message || 'Failed to get signature status'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: LEASE_ACTION_TYPES.GET_LEASE_SIGNATURE_STATUS_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error getting signature status'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const cancelLeaseSignature = (leaseId, reason = null) => async (dispatch) => {
  try {
    dispatch({ type: LEASE_ACTION_TYPES.CANCEL_LEASE_SIGNATURE_START });
    const response = await axiosServices.post(`/api/Lease/${leaseId}/cancel-signature`, { reason });
    
    if (response.data.success) {
      dispatch({
        type: LEASE_ACTION_TYPES.CANCEL_LEASE_SIGNATURE_SUCCESS,
        payload: {
          leaseId,
          signatureData: response.data.data || {}
        }
      });
      return { success: true, data: response.data.data };
    } else {
      dispatch({
        type: LEASE_ACTION_TYPES.CANCEL_LEASE_SIGNATURE_FAILED,
        payload: response.data.message || 'Failed to cancel signature'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: LEASE_ACTION_TYPES.CANCEL_LEASE_SIGNATURE_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error canceling signature'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const resendLeaseSignature = (leaseId) => async (dispatch) => {
  try {
    dispatch({ type: LEASE_ACTION_TYPES.RESEND_LEASE_SIGNATURE_START });
    const response = await axiosServices.post(`/api/Lease/${leaseId}/resend-signature`);
    
    if (response.data.success) {
      dispatch({
        type: LEASE_ACTION_TYPES.RESEND_LEASE_SIGNATURE_SUCCESS,
        payload: leaseId
      });
      return { success: true, data: response.data.data };
    } else {
      dispatch({
        type: LEASE_ACTION_TYPES.RESEND_LEASE_SIGNATURE_FAILED,
        payload: response.data.message || 'Failed to resend signature request'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: LEASE_ACTION_TYPES.RESEND_LEASE_SIGNATURE_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error resending signature request'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const endLease = (leaseId) => async (dispatch) => {
  try {
    const response = await axiosServices.post(`/api/lease/${leaseId}/end`);
    dispatch({
      type: LEASE_ACTION_TYPES.UPDATE_LEASE_SUCCESS,
      payload: response.data.data
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    console.error(error);
    dispatch({
      type: LEASE_ACTION_TYPES.UPDATE_LEASE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error;
  }
};

export const updateLeaseAgreement = (leaseId, agreementData) => async (dispatch) => {
  try {
    const response = await axiosServices.patch(`/api/Lease/${leaseId}/agreement`, agreementData);
    if (response.data.success) {
      dispatch({
        type: LEASE_ACTION_TYPES.UPDATE_LEASE_AGREEMENT_SUCCESS,
        payload: { leaseId, leaseAgreement: response.data.data }
      });
      return { success: true, data: response.data.data };
    } else {
      dispatch({ type: LEASE_ACTION_TYPES.UPDATE_LEASE_AGREEMENT_FAILED, payload: response.data.message });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({ type: LEASE_ACTION_TYPES.UPDATE_LEASE_AGREEMENT_FAILED, payload: error?.message });
    return { success: false, message: error?.message };
  }
};

export const reopenLease = (leaseId) => async (dispatch) => {
  try {
    const response = await axiosServices.post(`/api/lease/${leaseId}/reopen`);
    dispatch({
      type: LEASE_ACTION_TYPES.UPDATE_LEASE_SUCCESS,
      payload: response.data.data
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    console.error(error);
    dispatch({
      type: LEASE_ACTION_TYPES.UPDATE_LEASE_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error;
  }
};