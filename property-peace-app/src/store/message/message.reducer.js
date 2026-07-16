import { MESSAGE_ACTION_TYPES } from './message.types';

const initialState = {
  messages: [],
  selectedMessage: null,
  currentConversationId: null,
  loading: false,
  error: null
};

function messageReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case MESSAGE_ACTION_TYPES.SET_MESSAGES:
      return {
        ...state,
        messages: payload
      };

    case MESSAGE_ACTION_TYPES.SET_SELECTED_MESSAGE:
      return {
        ...state,
        selectedMessage: payload
      };

    case MESSAGE_ACTION_TYPES.GET_MESSAGES_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case MESSAGE_ACTION_TYPES.GET_MESSAGES_SUCCESS:
      return {
        ...state,
        messages: payload.messages || payload,
        currentConversationId: payload.conversationId || state.currentConversationId,
        loading: false,
        error: null
      };

    case MESSAGE_ACTION_TYPES.GET_MESSAGES_FAILED:
      return {
        ...state,
        messages: [],
        loading: false,
        error: payload
      };

    case MESSAGE_ACTION_TYPES.GET_MESSAGE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case MESSAGE_ACTION_TYPES.GET_MESSAGE_SUCCESS:
      return {
        ...state,
        selectedMessage: payload,
        messages: state.messages.map(msg =>
          msg.id === payload.id ? payload : msg
        ),
        loading: false,
        error: null
      };

    case MESSAGE_ACTION_TYPES.GET_MESSAGE_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case MESSAGE_ACTION_TYPES.ADD_MESSAGE_START:
      return {
        ...state,
        // Don't set loading: true here — sending a message should not trigger
        // the loading spinner. The component uses local sendingMessage state for the button.
        error: null
      };

    case MESSAGE_ACTION_TYPES.ADD_MESSAGE_SUCCESS:
      // Check if message already exists to avoid duplicates
      const messageExists = state.messages.some(msg => msg.id === payload.id);
      
      if (messageExists) {
        // Message already exists, don't add duplicate
        return {
          ...state,
          loading: false,
          error: null
        };
      }
      
      // Add the message - the component already filters by conversation
      return {
        ...state,
        messages: [...state.messages, payload],
        loading: false,
        error: null
      };

    case MESSAGE_ACTION_TYPES.ADD_MESSAGE_FAILED:
      return {
        ...state,
        error: payload
      };

    case MESSAGE_ACTION_TYPES.UPDATE_MESSAGE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case MESSAGE_ACTION_TYPES.UPDATE_MESSAGE_SUCCESS:
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === payload.id ? payload : msg
        ),
        selectedMessage: state.selectedMessage?.id === payload.id ? payload : state.selectedMessage,
        loading: false,
        error: null
      };

    case MESSAGE_ACTION_TYPES.UPDATE_MESSAGE_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case MESSAGE_ACTION_TYPES.DELETE_MESSAGE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case MESSAGE_ACTION_TYPES.DELETE_MESSAGE_SUCCESS:
      return {
        ...state,
        messages: state.messages.filter(msg => msg.id !== payload),
        selectedMessage: state.selectedMessage?.id === payload ? null : state.selectedMessage,
        loading: false,
        error: null
      };

    case MESSAGE_ACTION_TYPES.DELETE_MESSAGE_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case MESSAGE_ACTION_TYPES.MARK_MESSAGE_READ_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case MESSAGE_ACTION_TYPES.MARK_MESSAGE_READ_SUCCESS:
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === payload ? { ...msg, isRead: true } : msg
        ),
        loading: false,
        error: null
      };

    case MESSAGE_ACTION_TYPES.MARK_MESSAGE_READ_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case MESSAGE_ACTION_TYPES.MARK_CONVERSATION_READ_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case MESSAGE_ACTION_TYPES.MARK_CONVERSATION_READ_SUCCESS:
      return {
        ...state,
        messages: state.messages.map(msg => ({ ...msg, isRead: true })),
        loading: false,
        error: null
      };

    case MESSAGE_ACTION_TYPES.MARK_CONVERSATION_READ_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case MESSAGE_ACTION_TYPES.RESET_STATE:
      return {
        ...initialState
      };

    default:
      return state;
  }
}

export default messageReducer;

