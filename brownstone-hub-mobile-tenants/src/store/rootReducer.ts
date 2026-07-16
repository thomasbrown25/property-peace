import { combineReducers } from '@reduxjs/toolkit';
import userReducer from './user/user.slice';

const appReducer = combineReducers({
  user: userReducer,
  // Add other reducers here as needed
});

export const rootReducer = (state: any, action: any) => {
  // Reset state on logout if needed
  if (action.type === 'user/resetState') {
    state = undefined;
  }
  
  return appReducer(state, action);
};

export type RootState = ReturnType<typeof rootReducer>;
