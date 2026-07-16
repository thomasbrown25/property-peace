import listingApi from 'api/listing';
import { LISTING_ACTION_TYPES } from './listing.types';

export const setSelectedListing = (listing) => ({
  type: LISTING_ACTION_TYPES.SET_SELECTED_LISTING,
  payload: listing
});

export const clearSelectedListing = () => ({
  type: LISTING_ACTION_TYPES.CLEAR_SELECTED_LISTING
});

export const getListings = () => async (dispatch) => {
  dispatch({ type: LISTING_ACTION_TYPES.GET_LISTINGS_START });
  try {
    const response = await listingApi.getListings();
    if (response.success) {
      dispatch({
        type: LISTING_ACTION_TYPES.GET_LISTINGS_SUCCESS,
        payload: response.data
      });
      return { success: true, data: response.data };
    } else {
      dispatch({
        type: LISTING_ACTION_TYPES.GET_LISTINGS_FAILED,
        payload: response.message
      });
      return { success: false, message: response.message };
    }
  } catch (error) {
    dispatch({
      type: LISTING_ACTION_TYPES.GET_LISTINGS_FAILED,
      payload: error?.response?.data?.message || error?.message
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const getListingById = (id) => async (dispatch) => {
  dispatch({ type: LISTING_ACTION_TYPES.GET_LISTING_START });
  try {
    const response = await listingApi.getListingById(id);
    if (response.success) {
      const listing = response.data?.data ?? response.data;
      dispatch({
        type: LISTING_ACTION_TYPES.GET_LISTING_SUCCESS,
        payload: listing
      });
      return { success: true, data: listing };
    } else {
      dispatch({
        type: LISTING_ACTION_TYPES.GET_LISTING_FAILED,
        payload: response.message
      });
      return { success: false, message: response.message };
    }
  } catch (error) {
    dispatch({
      type: LISTING_ACTION_TYPES.GET_LISTING_FAILED,
      payload: error?.response?.data?.message || error?.message
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const createListing = (listingData, imageFiles = []) => async (dispatch) => {
  dispatch({ type: LISTING_ACTION_TYPES.CREATE_LISTING_START });
  try {
    const response = await listingApi.createListing(listingData, imageFiles);
    if (response.success) {
      const listing = response.data?.data ?? response.data;
      dispatch({
        type: LISTING_ACTION_TYPES.CREATE_LISTING_SUCCESS,
        payload: listing
      });
      return { success: true, data: listing };
    } else {
      dispatch({
        type: LISTING_ACTION_TYPES.CREATE_LISTING_FAILED,
        payload: response.message
      });
      return { success: false, message: response.message };
    }
  } catch (error) {
    dispatch({
      type: LISTING_ACTION_TYPES.CREATE_LISTING_FAILED,
      payload: error?.response?.data?.message || error?.message
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const updateListing = (id, listingData) => async (dispatch) => {
  dispatch({ type: LISTING_ACTION_TYPES.UPDATE_LISTING_START });
  try {
    const response = await listingApi.updateListing(id, listingData);
    if (response.success) {
      const listing = response.data?.data ?? response.data;
      dispatch({
        type: LISTING_ACTION_TYPES.UPDATE_LISTING_SUCCESS,
        payload: listing
      });
      return { success: true, data: listing };
    } else {
      dispatch({
        type: LISTING_ACTION_TYPES.UPDATE_LISTING_FAILED,
        payload: response.message
      });
      return { success: false, message: response.message };
    }
  } catch (error) {
    dispatch({
      type: LISTING_ACTION_TYPES.UPDATE_LISTING_FAILED,
      payload: error?.response?.data?.message || error?.message
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const publishListing = (id) => async (dispatch) => {
  dispatch({ type: LISTING_ACTION_TYPES.UPDATE_LISTING_START });
  try {
    const response = await listingApi.publishListing(id);
    if (response.success) {
      const listing = response.data?.data ?? response.data;
      dispatch({
        type: LISTING_ACTION_TYPES.UPDATE_LISTING_SUCCESS,
        payload: listing ?? {}
      });
      return { success: true, data: listing };
    } else {
      dispatch({ type: LISTING_ACTION_TYPES.UPDATE_LISTING_FAILED, payload: response.message });
      return { success: false, message: response.message };
    }
  } catch (error) {
    dispatch({
      type: LISTING_ACTION_TYPES.UPDATE_LISTING_FAILED,
      payload: error?.response?.data?.message || error?.message
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const deleteListing = (id) => async (dispatch) => {
  dispatch({ type: LISTING_ACTION_TYPES.DELETE_LISTING_START });
  try {
    const response = await listingApi.deleteListing(id);
    if (response.success) {
      dispatch({
        type: LISTING_ACTION_TYPES.DELETE_LISTING_SUCCESS,
        payload: id
      });
      return { success: true };
    } else {
      dispatch({
        type: LISTING_ACTION_TYPES.DELETE_LISTING_FAILED,
        payload: response.message
      });
      return { success: false, message: response.message };
    }
  } catch (error) {
    dispatch({
      type: LISTING_ACTION_TYPES.DELETE_LISTING_FAILED,
      payload: error?.response?.data?.message || error?.message
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};
