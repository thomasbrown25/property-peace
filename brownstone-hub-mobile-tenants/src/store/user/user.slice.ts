import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, UserState, UserSettings, NotificationSettings } from '../../types/user';
import authService, { LoginCredentials, RegisterData } from '../../services/authService';
import storageService from '../../services/storageService';

const initialState: UserState = {
  currentUser: null,
  settings: {
    darkMode: false,
    sidebarMini: false,
    activeColor: 'blue',
    propertyLayout: 'cards',
  },
  notificationSettings: null,
  isAuthenticated: null,
  loading: true,
  token: null,
  error: null,
};

// Async thunks
export const loadUser = createAsyncThunk('user/loadUser', async () => {
  const user = await authService.loadUser();
  return user;
});

export const login = createAsyncThunk('user/login', async (credentials: LoginCredentials) => {
  const user = await authService.login(credentials);
  return user;
});

export const register = createAsyncThunk('user/register', async (data: RegisterData) => {
  const user = await authService.register(data);
  return user;
});

export const googleLogin = createAsyncThunk(
  'user/googleLogin',
  async (params: { idToken?: string; accessToken?: string; registrationCode?: string }) => {
    const user = await authService.googleLogin(params.idToken, params.accessToken, params.registrationCode);
    return user;
  }
);

export const appleLogin = createAsyncThunk(
  'user/appleLogin',
  async (params: { idToken?: string; accessToken?: string }) => {
    const user = await authService.appleLogin(params.idToken, params.accessToken);
    return user;
  }
);

export const facebookLogin = createAsyncThunk(
  'user/facebookLogin',
  async (params: { accessToken?: string }) => {
    const user = await authService.facebookLogin(params.accessToken);
    return user;
  }
);

export const logout = createAsyncThunk('user/logout', async () => {
  await authService.logout();
});

export const initializeAuth = createAsyncThunk('user/initializeAuth', async () => {
  const token = await storageService.getToken();
  const isAuthenticated = await authService.isAuthenticated();
  const user = isAuthenticated ? await authService.getCurrentUser() : null;
  
  return {
    token,
    isAuthenticated,
    user,
  };
});

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateSettings: (state, action: PayloadAction<Partial<UserSettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    setNotificationSettings: (state, action: PayloadAction<NotificationSettings>) => {
      state.notificationSettings = action.payload;
    },
    updateTutorialStatus: (state) => {
      if (state.currentUser) {
        state.currentUser.hasSeenTutorial = true;
      }
    },
    resetState: () => initialState,
  },
  extraReducers: (builder) => {
    // Initialize auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.currentUser = action.payload.user;
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.token = null;
        state.currentUser = null;
      });

    // Load user
    builder
      .addCase(loadUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loadUser.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.currentUser = null;
        state.error = action.error.message;
      });

    // Login
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.jwtToken || null;
        state.currentUser = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.token = null;
        state.currentUser = null;
        state.isAuthenticated = false;
        state.error = action.error.message;
      });

    // Register
    builder
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.jwtToken || null;
        state.currentUser = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.token = null;
        state.currentUser = null;
        state.isAuthenticated = false;
        state.error = action.error.message;
      });

    // Google Login
    builder
      .addCase(googleLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.jwtToken || null;
        state.currentUser = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.loading = false;
        state.token = null;
        state.currentUser = null;
        state.isAuthenticated = false;
        state.error = action.error.message;
      });

    // Apple Login
    builder
      .addCase(appleLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(appleLogin.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.jwtToken || null;
        state.currentUser = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(appleLogin.rejected, (state, action) => {
        state.loading = false;
        state.token = null;
        state.currentUser = null;
        state.isAuthenticated = false;
        state.error = action.error.message;
      });

    // Facebook Login
    builder
      .addCase(facebookLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(facebookLogin.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.jwtToken || null;
        state.currentUser = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(facebookLogin.rejected, (state, action) => {
        state.loading = false;
        state.token = null;
        state.currentUser = null;
        state.isAuthenticated = false;
        state.error = action.error.message;
      });

    // Logout
    builder
      .addCase(logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.token = null;
        state.currentUser = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const { clearError, updateSettings, setNotificationSettings, updateTutorialStatus, resetState } = userSlice.actions;
export default userSlice.reducer;
