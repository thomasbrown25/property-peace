import axiosServices from 'utils/axios';
import { getBrowserTimezone } from 'utils/browserTimezone';

import { USER_ACTION_TYPES } from './user.types';

/** Calls the API service to register a user and returns a jwt token
 ** POST: "/user/register"
 * @param reqBody: { username, email, password }
 **/
export const register = (reqBody) => async (dispatch) => {
  try {
    const response = await axiosServices.post('/api/user/register', {
      ...reqBody,
      timezone: reqBody?.timezone || getBrowserTimezone()
    });
    const { data } = response;

    // Handle registration failure with a specific message
    if (data?.message?.includes('A user with that email address already exists')) {
      dispatch({
        type: USER_ACTION_TYPES.REGISTER_FAILED,
        payload: data.message
      });
      return;
    }

    // Dispatch success action and load user
    dispatch({
      type: USER_ACTION_TYPES.REGISTER_SUCCESS,
      payload: data.data
    });
    dispatch(loadUser());
  } catch (error) {
    console.error('Error during registration:', error);

    dispatch({
      type: USER_ACTION_TYPES.REGISTER_FAILED,
      payload: error?.response?.data?.errors
    });
  }
};

/** Calls the API service to login a user and returns a user object
 ** POST: "/api/user/login"
 * @param reqBody: { email, password }
 **/
export const login = (reqBody) => async (dispatch) => {
  try {
    const response = await axiosServices.post('/api/user/login', reqBody);

    dispatch({
      type: USER_ACTION_TYPES.SIGN_IN_SUCCESS,
      payload: response.data.data
    });

    dispatch(loadUser());
  } catch (error) {
    console.log(error, error.message);

    let payload;

    if (error.response?.data?.message) {
      payload = error.response.data.message;
    } else {
      payload = 'Sorry we ran into an issue. Please contact support for assistance.';
    }

    dispatch({
      type: USER_ACTION_TYPES.SIGN_IN_FAILED,
      payload: error?.response?.data?.errors || payload
    });
  }
};

/** Clears the login error from the state
 ** POST: "/api/user/login"
 * @param reqBody: { email, password }
 **/
export const clearLoginError = () => async (dispatch) => {
  try {
    dispatch({
      type: USER_ACTION_TYPES.CLEAR_ERROR
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: USER_ACTION_TYPES.CLEAR_ERROR_FAILED,
      payload: error
    });
  }
};

/** Calls the API service to get user data and load user
 ** GET: "/api/user/load-user"
 * @param reqBody: {  }
 **/
export const loadUser = () => async (dispatch) => {
  try {
    const response = await axiosServices.get('/api/user/load-user');

    dispatch({
      type: USER_ACTION_TYPES.USER_LOADED,
      payload: response.data.data
    });

    // Backfill browser timezone on first authenticated load if the account does not have one yet.
    try {
      const settingsResponse = await axiosServices.get('/api/user/settings');
      const existingSettings = settingsResponse?.data?.data;
      if (existingSettings && !existingSettings.timezone) {
        const detectedTimezone = getBrowserTimezone();
        const updatedSettings = { ...existingSettings, timezone: detectedTimezone };
        const saveResponse = await axiosServices.post('/api/user/settings', updatedSettings);
        dispatch({
          type: USER_ACTION_TYPES.SAVE_SETTINGS_SUCCESS,
          payload: saveResponse?.data?.data || updatedSettings
        });
      } else if (existingSettings) {
        dispatch({
          type: USER_ACTION_TYPES.GET_SETTINGS_SUCCESS,
          payload: existingSettings
        });
      }
    } catch (settingsError) {
      // Loading the user should not fail just because optional timezone backfill failed.
      console.warn('Unable to ensure browser timezone setting:', settingsError);
    }
  } catch (error) {
    console.log(error, error.message);
    //if (error.response?.status === 401) {
    dispatch({
      type: USER_ACTION_TYPES.SIGN_OUT
    });
    // }
  }
};

/** Logs out the user by removing the jwt token in local storage
 * @param reqBody: {  }
 **/
export const logout = () => async (dispatch) => {
  try {
    localStorage.removeItem('token');
    dispatch({
      type: USER_ACTION_TYPES.SIGN_OUT_SUCCESS
    });

    dispatch({ type: USER_ACTION_TYPES.RESET_STATE });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: USER_ACTION_TYPES.SIGN_OUT_FAILED
    });
  }
};

export const deleteAccount = () => async (dispatch) => {
  try {
    const response = await axiosServices.delete('/api/user/user');

    dispatch({
      type: USER_ACTION_TYPES.DELETE_ACCOUNT_SUCCESS,
      payload: response.data.data
    });

    localStorage.removeItem('token');
    dispatch({
      type: USER_ACTION_TYPES.SIGN_OUT
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: USER_ACTION_TYPES.DELETE_ACCOUNT_FAILED,
      payload: error?.response?.data?.errors
    });
  }
};

/**
 ** GET: "/api/usersetting"
 * @param reqBody: null
 **/
export const getSettings = () => async (dispatch) => {
  try {
    const response = await axiosServices.get('/api/user/settings');

    dispatch({
      type: USER_ACTION_TYPES.GET_SETTINGS_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: USER_ACTION_TYPES.GET_SETTINGS_FAILED,
      payload: error?.response?.data?.errors
    });
  }
};

export const saveSettings = (newSettings) => async (dispatch) => {
  try {
    const response = await axiosServices.post('/api/user/settings', newSettings);

    // Ensure we have valid data before dispatching
    const settingsData = response?.data?.data || response?.data || newSettings;

    dispatch({
      type: USER_ACTION_TYPES.SAVE_SETTINGS_SUCCESS,
      payload: settingsData
    });
  } catch (error) {
    console.log(error, error.message);
    dispatch({
      type: USER_ACTION_TYPES.SAVE_SETTINGS_FAILED,
      payload: error?.response?.data?.errors || error?.message || 'Failed to save settings'
    });
  }
};

/**
 * Updates user's tutorial status
 * PUT: "/api/user/tutorial-status"
 * Updates the tutorial status for the current authenticated user
 * @param userId - The user ID (unused, kept for backward compatibility)
 */
export const updateTutorialStatus = (userId) => async (dispatch) => {
  try {
    const response = await axiosServices.put(`/api/user/tutorial-status`, { hasSeenTutorial: true }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    dispatch({
      type: USER_ACTION_TYPES.UPDATE_TUTORIAL_STATUS_SUCCESS,
      payload: response.data.data
    });
  } catch (error) {
    console.log('Error updating tutorial status:', error);
    dispatch({
      type: USER_ACTION_TYPES.UPDATE_TUTORIAL_STATUS_FAILED,
      payload: error?.response?.data?.errors
    });
  }
};

/**
 * Gets user's notification settings
 * GET: "/api/user/notification-settings"
 */
export const getNotificationSettings = () => async (dispatch) => {
  try {
    const response = await axiosServices.get('/api/user/notification-settings');

    dispatch({
      type: USER_ACTION_TYPES.GET_NOTIFICATION_SETTINGS_SUCCESS,
      payload: response.data.data
    });

    return { payload: response.data.data };
  } catch (error) {
    console.error('Error loading notification settings:', error);
    dispatch({
      type: USER_ACTION_TYPES.GET_NOTIFICATION_SETTINGS_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error;
  }
};

/**
 * Saves user's notification settings
 * POST: "/api/user/notification-settings"
 * @param settings - The notification settings object
 */
export const saveNotificationSettings = (settings) => async (dispatch) => {
  try {
    const response = await axiosServices.post('/api/user/notification-settings', settings);

    dispatch({
      type: USER_ACTION_TYPES.SAVE_NOTIFICATION_SETTINGS_SUCCESS,
      payload: response.data.data
    });

    return { payload: response.data.data };
  } catch (error) {
    console.error('Error saving notification settings:', error);
    dispatch({
      type: USER_ACTION_TYPES.SAVE_NOTIFICATION_SETTINGS_FAILED,
      payload: error?.response?.data?.errors || error?.message
    });
    throw error;
  }
};