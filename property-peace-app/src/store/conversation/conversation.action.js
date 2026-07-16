import axiosServices from 'utils/axios';
import { CONVERSATION_ACTION_TYPES } from './conversation.types';

export const setConversation = (conversation) => ({
  type: CONVERSATION_ACTION_TYPES.SET_CONVERSATION,
  payload: conversation ? { ...conversation } : null
});

export const setSelectedConversation = (conversationOrId) => {
  // Accept either a conversation object or just an ID
  // If it's an ID, the reducer will look it up from state
  // If it's an object, the reducer will create a copy
  return {
    type: CONVERSATION_ACTION_TYPES.SET_SELECTED_CONVERSATION,
    payload: conversationOrId
  };
};

export const getConversations = (includeArchived = false) => async (dispatch) => {
  try {
    dispatch({ type: CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_START });
    const response = await axiosServices.get(`/api/Conversation?includeArchived=${includeArchived}`);
    
    if (response.data.success) {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_SUCCESS,
        payload: response.data.data || []
      });
    } else {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_FAILED,
        payload: response.data.message || 'Failed to load conversations'
      });
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error loading conversations'
    });
  }
};

export const getConversation = (conversationId) => async (dispatch) => {
  try {
    dispatch({ type: CONVERSATION_ACTION_TYPES.GET_CONVERSATION_START });
    const response = await axiosServices.get(`/api/Conversation/${conversationId}`);
    
    if (response.data.success) {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.GET_CONVERSATION_SUCCESS,
        payload: response.data.data
      });
    } else {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.GET_CONVERSATION_FAILED,
        payload: response.data.message || 'Failed to load conversation'
      });
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: CONVERSATION_ACTION_TYPES.GET_CONVERSATION_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error loading conversation'
    });
  }
};

export const addConversation = (conversationData) => async (dispatch) => {
  try {
    dispatch({ type: CONVERSATION_ACTION_TYPES.ADD_CONVERSATION_START });
    const response = await axiosServices.post('/api/Conversation', conversationData);
    
    if (response.data.success) {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.ADD_CONVERSATION_SUCCESS,
        payload: response.data.data
      });
      return { success: true, data: response.data.data };
    } else {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.ADD_CONVERSATION_FAILED,
        payload: response.data.message || 'Failed to create conversation'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: CONVERSATION_ACTION_TYPES.ADD_CONVERSATION_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error creating conversation'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const updateConversation = (conversationId, conversationData) => async (dispatch) => {
  try {
    dispatch({ type: CONVERSATION_ACTION_TYPES.UPDATE_CONVERSATION_START });
    const response = await axiosServices.put(`/api/Conversation/${conversationId}`, conversationData);
    
    if (response.data.success) {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.UPDATE_CONVERSATION_SUCCESS,
        payload: response.data.data
      });
      return { success: true, data: response.data.data };
    } else {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.UPDATE_CONVERSATION_FAILED,
        payload: response.data.message || 'Failed to update conversation'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: CONVERSATION_ACTION_TYPES.UPDATE_CONVERSATION_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error updating conversation'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const deleteConversation = (conversationId) => async (dispatch) => {
  try {
    dispatch({ type: CONVERSATION_ACTION_TYPES.DELETE_CONVERSATION_START });
    const response = await axiosServices.delete(`/api/Conversation/${conversationId}`);
    
    if (response.data.success) {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.DELETE_CONVERSATION_SUCCESS,
        payload: conversationId
      });
      return { success: true };
    } else {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.DELETE_CONVERSATION_FAILED,
        payload: response.data.message || 'Failed to delete conversation'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: CONVERSATION_ACTION_TYPES.DELETE_CONVERSATION_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error deleting conversation'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const archiveConversation = (conversationId, archive = true) => async (dispatch) => {
  try {
    dispatch({ type: CONVERSATION_ACTION_TYPES.ARCHIVE_CONVERSATION_START });
    const response = await axiosServices.post(
      `/api/Conversation/${conversationId}/archive`,
      archive,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (response.data.success) {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.ARCHIVE_CONVERSATION_SUCCESS,
        payload: { id: conversationId, isArchived: archive }
      });
      return { success: true };
    } else {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.ARCHIVE_CONVERSATION_FAILED,
        payload: response.data.message || 'Failed to archive conversation'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: CONVERSATION_ACTION_TYPES.ARCHIVE_CONVERSATION_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error archiving conversation'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const pinConversation = (conversationId, pin = true) => async (dispatch) => {
  try {
    dispatch({ type: CONVERSATION_ACTION_TYPES.PIN_CONVERSATION_START });
    const response = await axiosServices.post(
      `/api/Conversation/${conversationId}/pin`,
      pin,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (response.data.success) {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.PIN_CONVERSATION_SUCCESS,
        payload: { id: conversationId, isPinned: pin }
      });
      return { success: true };
    } else {
      dispatch({
        type: CONVERSATION_ACTION_TYPES.PIN_CONVERSATION_FAILED,
        payload: response.data.message || 'Failed to pin conversation'
      });
      return { success: false, message: response.data.message };
    }
  } catch (error) {
    console.error(error);
    dispatch({
      type: CONVERSATION_ACTION_TYPES.PIN_CONVERSATION_FAILED,
      payload: error?.response?.data?.message || error?.message || 'Error pinning conversation'
    });
    return { success: false, message: error?.response?.data?.message || error?.message };
  }
};

export const resetConversationState = () => ({
  type: CONVERSATION_ACTION_TYPES.RESET_STATE
});

