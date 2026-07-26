// action - state management
import { REGISTER, LOGIN, LOGOUT, UPDATE_USER } from './actions';

// initial state
const initialState = {
  isLoggedIn: false,
  isInitialized: false,
  user: null
};

// ==============================|| AUTH REDUCER ||============================== //

const auth = (state = initialState, action) => {
  switch (action.type) {
    case REGISTER: {
      const { user } = action.payload;
      return {
        ...state,
        user
      };
    }
    case LOGIN: {
      const { user } = action.payload;
      return {
        ...state,
        isLoggedIn: true,
        isInitialized: true,
        user
      };
    }
    case LOGOUT: {
      return {
        ...state,
        isInitialized: true,
        isLoggedIn: false,
        user: null
      };
    }
    case UPDATE_USER: {
      // If payload is a full user object (has Id), replace the entire user
      // Otherwise, merge updates into existing user
      if (action.payload?.Id || action.payload?.id) {
        return {
          ...state,
          user: action.payload
        };
      }
      return {
        ...state,
        user: {
          ...state.user,
          ...action.payload
        }
      };
    }
    case 'SET_IMPERSONATION': {
      return { ...state, impersonation: action.payload || null };
    }
    case 'INITIALIZED': {
      return {
        ...state,
        isInitialized: action.payload ?? true
      };
    }
    default: {
      return { ...state };
    }
  }
};

export default auth;
