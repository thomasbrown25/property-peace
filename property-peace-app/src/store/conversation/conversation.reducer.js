import { CONVERSATION_ACTION_TYPES } from './conversation.types';
import { MESSAGE_ACTION_TYPES } from '../message/message.types';

const initialState = {
  conversations: [],
  selectedConversation: null,
  loading: false,
  error: null
};

// Helper function to create a deep copy of a conversation object
function copyConversation(conv) {
  if (!conv) return null;

  const copied = { ...conv };

  // Deep copy participants array (each participant is an object)
  if (copied.participants && Array.isArray(copied.participants)) {
    copied.participants = copied.participants.map((participant) => ({ ...participant }));
  }

  // Deep copy metadata object
  if (copied.metadata && typeof copied.metadata === 'object' && !Array.isArray(copied.metadata)) {
    copied.metadata = { ...copied.metadata };
  }

  // Deep copy messages array if it exists (each message is an object)
  if (copied.messages && Array.isArray(copied.messages)) {
    copied.messages = copied.messages.map((message) => ({ ...message }));
  }

  return copied;
}

function conversationReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case CONVERSATION_ACTION_TYPES.SET_CONVERSATION:
      return {
        ...state,
        selectedConversation: copyConversation(payload)
      };

    case CONVERSATION_ACTION_TYPES.SET_SELECTED_CONVERSATION:
      // If payload is a number/string (ID), look up the conversation from state
      // Otherwise, treat it as a conversation object
      let conversationToSet = null;
      if (typeof payload === 'number' || typeof payload === 'string') {
        // Find the conversation by ID in the current state
        const foundConv = state.conversations.find((conv) => conv.id === payload || conv.id === Number(payload));
        if (foundConv) {
          // Create a shallow copy to break the reference - this prevents Redux from detecting mutations
          conversationToSet = { ...foundConv };
        }
      } else if (payload && typeof payload === 'object') {
        // It's a conversation object - create a shallow copy to break any references
        conversationToSet = { ...payload };
      }

      return {
        ...state,
        selectedConversation: conversationToSet
      };

    case CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_SUCCESS:
      const newConversations = (payload || []).map((conv) => copyConversation(conv));

      // Update selectedConversation if it exists in the new conversations array
      // Always create a separate copy to avoid sharing references with the array
      let updatedSelectedConversation = state.selectedConversation;
      if (updatedSelectedConversation) {
        const matchingConv = newConversations.find((conv) => conv.id === updatedSelectedConversation.id);
        if (matchingConv) {
          // Create a separate copy even if it matches, to avoid sharing references
          updatedSelectedConversation = copyConversation(matchingConv);
        } else {
          // If selected conversation is not in the new list, create a copy to avoid mutations
          updatedSelectedConversation = copyConversation(updatedSelectedConversation);
        }
      }

      return {
        ...state,
        conversations: newConversations,
        selectedConversation: updatedSelectedConversation,
        loading: false,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.GET_CONVERSATIONS_FAILED:
      return {
        ...state,
        conversations: [],
        loading: false,
        error: payload
      };

    case CONVERSATION_ACTION_TYPES.GET_CONVERSATION_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.GET_CONVERSATION_SUCCESS:
      const newConversation = copyConversation(payload);
      return {
        ...state,
        selectedConversation: newConversation,
        conversations: state.conversations.map((conv) => {
          if (conv.id === payload.id) {
            return newConversation;
          }
          // For non-matching conversations, still create a new object to avoid mutations
          return copyConversation(conv);
        }),
        loading: false,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.GET_CONVERSATION_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case CONVERSATION_ACTION_TYPES.ADD_CONVERSATION_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.ADD_CONVERSATION_SUCCESS:
      const newAddedConversation = copyConversation(payload);
      return {
        ...state,
        conversations: [newAddedConversation, ...state.conversations.map((conv) => copyConversation(conv))],
        selectedConversation: newAddedConversation,
        loading: false,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.ADD_CONVERSATION_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case CONVERSATION_ACTION_TYPES.UPDATE_CONVERSATION_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.UPDATE_CONVERSATION_SUCCESS:
      const updatedConversation = copyConversation(payload);
      return {
        ...state,
        conversations: state.conversations.map((conv) => {
          if (conv.id === payload.id) {
            return updatedConversation;
          }
          // For non-matching conversations, still create a new object to avoid mutations
          return copyConversation(conv);
        }),
        selectedConversation:
          state.selectedConversation?.id === payload.id ? updatedConversation : copyConversation(state.selectedConversation),
        loading: false,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.UPDATE_CONVERSATION_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case CONVERSATION_ACTION_TYPES.DELETE_CONVERSATION_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.DELETE_CONVERSATION_SUCCESS:
      return {
        ...state,
        conversations: state.conversations.filter((conv) => conv.id !== payload),
        selectedConversation: state.selectedConversation?.id === payload ? null : copyConversation(state.selectedConversation),
        loading: false,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.DELETE_CONVERSATION_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case CONVERSATION_ACTION_TYPES.ARCHIVE_CONVERSATION_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.ARCHIVE_CONVERSATION_SUCCESS:
      return {
        ...state,
        conversations: state.conversations.map((conv) => {
          if (conv.id === payload.id) {
            const updatedConv = copyConversation(conv);
            updatedConv.isArchived = payload.isArchived;
            return updatedConv;
          }
          // For non-matching conversations, still create a new object to avoid mutations
          return copyConversation(conv);
        }),
        selectedConversation:
          state.selectedConversation?.id === payload.id
            ? (() => {
                const updated = copyConversation(state.selectedConversation);
                updated.isArchived = payload.isArchived;
                return updated;
              })()
            : copyConversation(state.selectedConversation),
        loading: false,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.ARCHIVE_CONVERSATION_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case CONVERSATION_ACTION_TYPES.PIN_CONVERSATION_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.PIN_CONVERSATION_SUCCESS:
      return {
        ...state,
        conversations: state.conversations.map((conv) => {
          if (conv.id === payload.id) {
            const updatedConv = copyConversation(conv);
            updatedConv.isPinned = payload.isPinned;
            return updatedConv;
          }
          // For non-matching conversations, still create a new object to avoid mutations
          return copyConversation(conv);
        }),
        selectedConversation:
          state.selectedConversation?.id === payload.id
            ? (() => {
                const updated = copyConversation(state.selectedConversation);
                updated.isPinned = payload.isPinned;
                return updated;
              })()
            : copyConversation(state.selectedConversation),
        loading: false,
        error: null
      };

    case CONVERSATION_ACTION_TYPES.PIN_CONVERSATION_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case CONVERSATION_ACTION_TYPES.RESET_STATE:
      return {
        ...initialState
      };

    // Handle marking conversation as read (from message actions)
    case MESSAGE_ACTION_TYPES.MARK_CONVERSATION_READ_SUCCESS:
      return {
        ...state,
        conversations: state.conversations.map((conv) => {
          if (conv.id === payload) {
            const updatedConv = copyConversation(conv);
            updatedConv.unreadCount = 0;
            return updatedConv;
          }
          // For non-matching conversations, still create a new object to avoid mutations
          return copyConversation(conv);
        }),
        selectedConversation:
          state.selectedConversation?.id === payload
            ? (() => {
                const updated = copyConversation(state.selectedConversation);
                updated.unreadCount = 0;
                return updated;
              })()
            : copyConversation(state.selectedConversation),
        loading: false,
        error: null
      };

    default:
      return state;
  }
}

export default conversationReducer;
