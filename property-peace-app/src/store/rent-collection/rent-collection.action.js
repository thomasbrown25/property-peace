import axiosServices from 'utils/axios';
import { RENT_COLLECTION_ACTION_TYPES } from './rent-collection.types';

const _rentCollectionFetchPending = new Map();

export const getRentCollection = (propertyId, lifetime) => async (dispatch) => {
  const key = `${propertyId ?? 'null'}-${lifetime}`;
  if (_rentCollectionFetchPending.get(key)) return;
  _rentCollectionFetchPending.set(key, true);
  try {
    dispatch({ type: RENT_COLLECTION_ACTION_TYPES.GET_RENT_COLLECTION_START });
    
    // Build query params - organizationId is sent via X-Organization-Id header
    const response = await axiosServices.get('/api/rent-collection', {
      params: {
        lifetime,
        ...(propertyId ? { propertyId } : {}) // only include if not null
      }
    });

    dispatch({
      type: RENT_COLLECTION_ACTION_TYPES.GET_RENT_COLLECTION_SUCCESS,
      payload: {
        ...response.data.data,
        isLifetime: lifetime
      }
    });
  } catch (error) {
    dispatch({
      type: RENT_COLLECTION_ACTION_TYPES.GET_RENT_COLLECTION_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
  } finally {
    _rentCollectionFetchPending.set(key, false);
  }
};

export const makePayment = (leaseId, paymentDate, amount) => async (dispatch) => {
  try {
    dispatch({ type: RENT_COLLECTION_ACTION_TYPES.MAKE_PAYMENT_START });
    
    const response = await axiosServices.post('/api/rent-collection/payment', {
      leaseId,
      paymentDate,
      amount
    });

    dispatch({
      type: RENT_COLLECTION_ACTION_TYPES.MAKE_PAYMENT_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    dispatch({
      type: RENT_COLLECTION_ACTION_TYPES.MAKE_PAYMENT_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
  }
};

export const sendRentReminder = (leaseId) => async (dispatch) => {
  try {
    dispatch({ type: RENT_COLLECTION_ACTION_TYPES.SEND_REMINDER_START });
    
    const response = await axiosServices.post(`/api/rent-collection/send-reminder/${leaseId}`);

    dispatch({
      type: RENT_COLLECTION_ACTION_TYPES.SEND_REMINDER_SUCCESS,
      payload: response.data.data
    });
    
    return { success: true, message: response.data.message || 'Reminder sent successfully' };
  } catch (error) {
    dispatch({
      type: RENT_COLLECTION_ACTION_TYPES.SEND_REMINDER_FAILURE,
      payload: error?.response?.data?.errors || error.message
    });
    
    return { 
      success: false, 
      message: error?.response?.data?.message || error?.message || 'Failed to send reminder' 
    };
  }
};