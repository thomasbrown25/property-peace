import { configureStore } from '@reduxjs/toolkit';

import { rootReducer } from './root-reducer';

const initialState = {};

// Disable redux-logger and devTools
const middleware = []; // Removed redux-logger

const store = configureStore({
  reducer: rootReducer,
  preloadedState: initialState,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(middleware),
  devTools: false // Disabled Redux DevTools
});

/*
  initialize current state from redux store for subscription comparison
  preventing undefined error
 */
let currentState = store.getState();

store.subscribe(() => {
  // keep track of the previous and current state to compare changes
  let previousState = currentState;
  currentState = store.getState();

  // Check if the token has actually changed and is not null
  //   if (previousState.user.token !== currentState.user.token) {
  //     console.log('Token change detected');
  //     const token = currentState.user.token;
  //     if (token) {
  //       console.log('Setting auth token');
  //       setAuthToken(token);
  //       localStorage.setItem('token', token);
  //     } else {
  //       console.log('Removing auth token');
  //       setAuthToken(null);
  //       localStorage.removeItem('token');
  //     }
  //   }
});

export default store;
