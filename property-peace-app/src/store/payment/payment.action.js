import axiosServices from 'utils/axios';
import { PAYMENT_ACTION_TYPES } from './payment.types';

export const getAllPayments = () => async (dispatch) => {
  try {
    const response = await axiosServices.get('/api/payment/all');
    const data = response?.data?.data ?? response?.data;
    dispatch({
      type: PAYMENT_ACTION_TYPES.GET_ALL_PAYMENTS_SUCCESS,
      payload: Array.isArray(data) ? data : []
    });
  } catch (error) {
    dispatch({
      type: PAYMENT_ACTION_TYPES.GET_ALL_PAYMENTS_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
  }
};

export const getPayments = (leaseId) => async (dispatch) => {
  try {
    // Build query params
    const response = await axiosServices.get(`/api/payment/${leaseId}`);

    dispatch({
      type: PAYMENT_ACTION_TYPES.GET_PAYMENTS_SUCCESS,
      payload: response.data
    });
  } catch (error) {
    dispatch({
      type: PAYMENT_ACTION_TYPES.GET_PAYMENTS_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
  }
};
