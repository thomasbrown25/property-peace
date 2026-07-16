import axiosServices from 'utils/axios';
import { MESSAGE_ACTION_TYPES } from './message.types';

export const setMessages = (messages) => ({
  type: MESSAGE_ACTION_TYPES.SET_MESSAGES,
  payload: messages
});

export const setSelectedMessage = (message) => ({
  type: MESSAGE_ACTION_TYPES.SET_SELECTED_MESSAGE,
  payload: message
});

export const getMessages = (conversationId, skip = 0, take = 50) => async (dispatch) => {
  try {
    dispatch({ type: MESSAGE_ACTION_TYPES.GET_MESSAGES_START });
    const response = await axiosServices.get(`/api/Message/conversation/${conversationId}?skip=${skip}&take=${take}`);
    
    if (response.data.success) {
      dispatch({
        type: MESSAGE_ACTION_TYPES.GET_MESSAGES_SUCCESS,
        payload: { messages: response.data.data || [], conversationId }
      });
    } else {
      dispatch({
        type: MESSAGE_ACTION_TYPES.GET_MESSAGES_FAILED,
        payload: response.data.message || 'Failed to load messages'
      });
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: MESSAGE_ACTION_TYPES.GET_MESSAGES_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error loading messages'
    });
  }
};

export const getMessage = (messageId) => async (dispatch) => {
  try {
    dispatch({ type: MESSAGE_ACTION_TYPES.GET_MESSAGE_START });
    const response = await axiosServices.get(`/api/Message/${messageId}`);
    
    if (response.data.success) {
      dispatch({
        type: MESSAGE_ACTION_TYPES.GET_MESSAGE_SUCCESS,
        payload: response.data.data
      });
    } else {
      dispatch({
        type: MESSAGE_ACTION_TYPES.GET_MESSAGE_FAILED,
        payload: response.data.message || 'Failed to load message'
      });
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: MESSAGE_ACTION_TYPES.GET_MESSAGE_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error loading message'
    });
  }
};

export const addMessage = (messageData) => async (dispatch) => {
  try {
    dispatch({ type: MESSAGE_ACTION_TYPES.ADD_MESSAGE_START });
    const response = await axiosServices.post('/api/Message', messageData);
    
    if (response.data.success) {
      dispatch({
        type: MESSAGE_ACTION_TYPES.ADD_MESSAGE_SUCCESS,
        payload: response.data.data
      });
      return { success: true, data: response.data.data };
    } else {
      dispatch({
        type: MESSAGE_ACTION_TYPES.ADD_MESSAGE_FAILED,
        payload: response.data.message || 'Failed to send message'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: MESSAGE_ACTION_TYPES.ADD_MESSAGE_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error sending message'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const updateMessage = (messageId, content) => async (dispatch) => {
  try {
    dispatch({ type: MESSAGE_ACTION_TYPES.UPDATE_MESSAGE_START });
    const response = await axiosServices.put(`/api/Message/${messageId}`, content);
    
    if (response.data.success) {
      dispatch({
        type: MESSAGE_ACTION_TYPES.UPDATE_MESSAGE_SUCCESS,
        payload: response.data.data
      });
      return { success: true, data: response.data.data };
    } else {
      dispatch({
        type: MESSAGE_ACTION_TYPES.UPDATE_MESSAGE_FAILED,
        payload: response.data.message || 'Failed to update message'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: MESSAGE_ACTION_TYPES.UPDATE_MESSAGE_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error updating message'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const deleteMessage = (messageId) => async (dispatch) => {
  try {
    dispatch({ type: MESSAGE_ACTION_TYPES.DELETE_MESSAGE_START });
    const response = await axiosServices.delete(`/api/Message/${messageId}`);
    
    if (response.data.success) {
      dispatch({
        type: MESSAGE_ACTION_TYPES.DELETE_MESSAGE_SUCCESS,
        payload: messageId
      });
      return { success: true };
    } else {
      dispatch({
        type: MESSAGE_ACTION_TYPES.DELETE_MESSAGE_FAILED,
        payload: response.data.message || 'Failed to delete message'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: MESSAGE_ACTION_TYPES.DELETE_MESSAGE_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error deleting message'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const markMessageAsRead = (messageId) => async (dispatch) => {
  try {
    dispatch({ type: MESSAGE_ACTION_TYPES.MARK_MESSAGE_READ_START });
    const response = await axiosServices.post(`/api/Message/${messageId}/read`);
    
    if (response.data.success) {
      dispatch({
        type: MESSAGE_ACTION_TYPES.MARK_MESSAGE_READ_SUCCESS,
        payload: messageId
      });
      return { success: true };
    } else {
      dispatch({
        type: MESSAGE_ACTION_TYPES.MARK_MESSAGE_READ_FAILED,
        payload: response.data.message || 'Failed to mark message as read'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: MESSAGE_ACTION_TYPES.MARK_MESSAGE_READ_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error marking message as read'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const markConversationAsRead = (conversationId) => async (dispatch) => {
  try {
    dispatch({ type: MESSAGE_ACTION_TYPES.MARK_CONVERSATION_READ_START });
    const response = await axiosServices.post(`/api/Message/conversation/${conversationId}/read`);
    
    if (response.data.success) {
      dispatch({
        type: MESSAGE_ACTION_TYPES.MARK_CONVERSATION_READ_SUCCESS,
        payload: conversationId
      });
      return { success: true };
    } else {
      dispatch({
        type: MESSAGE_ACTION_TYPES.MARK_CONVERSATION_READ_FAILED,
        payload: response.data.message || 'Failed to mark conversation as read'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: MESSAGE_ACTION_TYPES.MARK_CONVERSATION_READ_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error marking conversation as read'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const resetMessageState = () => ({
  type: MESSAGE_ACTION_TYPES.RESET_STATE
});

