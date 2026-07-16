export const selectCurrentUser = (state) => state.user.currentUser;

export const selectIsAuthenticated = (state) => state.user.isAuthenticated;

export const selectIsLoadingAuth = (state) => state.user.loading;

export const selectUser = (state) => state.user;

export const selectUserRole = (state) => {
  const user = state.user?.currentUser;
  // Handle both uppercase (from API) and lowercase (legacy) property names
  return user?.Roles || user?.roles || [];
};

export const selectUserSettings = (state) => state.user?.settings || {};