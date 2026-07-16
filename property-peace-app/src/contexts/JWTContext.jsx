import { createContext, useEffect, useReducer } from 'react';

// third-party
import { Chance } from 'chance';
import { jwtDecode } from 'jwt-decode';
import { useSWRConfig } from 'swr';

// reducer - state management
import { LOGIN, LOGOUT, UPDATE_USER } from 'contexts/auth-reducer/actions';
import authReducer from 'contexts/auth-reducer/auth';

// project imports
import Loader from 'components/Loader';
import axios from 'utils/axios';
import store from 'store';
import { USER_ACTION_TYPES } from 'store/user/user.types';
import { getBrowserTimezone } from 'utils/browserTimezone';

const chance = new Chance();

// constant
const initialState = {
  isLoggedIn: false,
  isInitialized: false,
  user: null
};

const verifyToken = (serviceToken) => {
  if (!serviceToken) return false;
  try {
    const decoded = jwtDecode(serviceToken);
    return decoded.exp > Date.now() / 1000;
  } catch (e) {
    return false;
  }
};

const setSession = (serviceToken) => {
  if (serviceToken) {
    localStorage.setItem('serviceToken', serviceToken);
    axios.defaults.headers.common.Authorization = `Bearer ${serviceToken}`;
  } else {
    localStorage.removeItem('serviceToken');
    delete axios.defaults.headers.common.Authorization;
  }
};

const ensureBrowserTimezoneSetting = async () => {
  try {
    const settingsResponse = await axios.get('/api/user/settings');
    const existingSettings = settingsResponse?.data?.data;
    if (!existingSettings) return;

    if (!existingSettings.timezone) {
      const updatedSettings = {
        ...existingSettings,
        timezone: getBrowserTimezone()
      };
      const saveResponse = await axios.post('/api/user/settings', updatedSettings);
      store.dispatch({
        type: USER_ACTION_TYPES.SAVE_SETTINGS_SUCCESS,
        payload: saveResponse?.data?.data || updatedSettings
      });
      return;
    }

    store.dispatch({
      type: USER_ACTION_TYPES.GET_SETTINGS_SUCCESS,
      payload: existingSettings
    });
  } catch (error) {
    // Timezone detection is best-effort and should never block auth.
    console.warn('Unable to ensure browser timezone setting:', error);
  }
};

// ==============================|| JWT CONTEXT & PROVIDER ||============================== //

const JWTContext = createContext(null);

export const JWTProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { mutate: swrMutate } = useSWRConfig();

  useEffect(() => {
    const init = async () => {
      try {
        const serviceToken = localStorage.getItem('serviceToken');


        if (serviceToken && verifyToken(serviceToken)) {
          setSession(serviceToken);

          // ✅ only mark logged in if we actually load a user
          try {
            const response = await axios.get('/api/user/load-user');

            // Check if response is successful
            if (response.data && response.data.success && response.data.data) {
              const user = response.data.data;


              dispatch({
                type: LOGIN,
                payload: {
                  isLoggedIn: true,
                  user
                }
              });
              await ensureBrowserTimezoneSetting();
            } else {
              // Invalid response structure
              dispatch({ type: LOGOUT });
            }
          } catch (apiError) {
            // API call failed (401, network error, etc.)
            // If it's a 401, token is invalid - clear it
            if (apiError.response?.status === 401) {
              setSession(null);
            }
            dispatch({ type: LOGOUT });
          }
        } else {
          // No token or token expired
          if (serviceToken) {
            setSession(null);
          }
          dispatch({ type: LOGOUT });
        }
      } catch (err) {
        dispatch({ type: LOGOUT });
      } finally {
        // ✅ ensure we always mark initialized once
        dispatch({
          type: 'INITIALIZED',
          payload: true
        });
      }
    };

    // Only initialize if not already initialized
    if (!state.isInitialized) {
      init();
    }
  }, [state.isInitialized]);

  const login = async (email, password) => {
    const response = await axios.post('/api/user/login', { email, password });
    const user = response.data?.data;


    setSession(user.jwtToken);
    dispatch({
      type: LOGIN,
      payload: {
        isLoggedIn: true,
        user
      }
    });
    await ensureBrowserTimezoneSetting();

    // Check for invite tokens in URL and accept them if present
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('inviteToken');
    const tenantInviteToken = urlParams.get('tenantInviteToken') || sessionStorage.getItem('tenantInviteToken');

    // Check for organization invite
    if (inviteToken) {
      try {
        // Import acceptInvite dynamically to avoid circular dependencies
        const { acceptInvite } = await import('../api/organizationInvite');
        const acceptResponse = await acceptInvite(inviteToken);

        if (acceptResponse?.success) {
          // Clear inviteToken from URL
          urlParams.delete('inviteToken');
          const newQuery = urlParams.toString();
          window.history.replaceState({}, '', `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`);
        }
      } catch (error) {
        // Continue with normal redirect even if invite acceptance fails
      }
    }

    // Check for tenant invite
    if (tenantInviteToken) {
      try {
        const { acceptTenantInvite } = await import('../api/tenantInvite');
        const email = sessionStorage.getItem('tenantInviteEmail') || user?.email;
        const propertyName = sessionStorage.getItem('tenantInvitePropertyName') || 'the property';

        if (email) {
          const acceptResponse = await tenantInviteAPI.acceptTenantInvite({
            inviteToken: tenantInviteToken,
            email: email.trim()
          });

          if (acceptResponse?.success) {
            // Clear tenant invite data from sessionStorage
            sessionStorage.removeItem('tenantInviteToken');
            sessionStorage.removeItem('tenantInviteEmail');
            sessionStorage.removeItem('pendingTenantInvite');
            sessionStorage.removeItem('tenantInvitePropertyName');

            // Clear from URL
            urlParams.delete('tenantInviteToken');
            const newQuery = urlParams.toString();
            window.history.replaceState({}, '', `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`);

            // Redirect to success page
            setTimeout(() => {
              window.location.replace(`/tenant/invite/success?propertyName=${encodeURIComponent(propertyName)}`);
            }, 100);
            return; // Don't continue with normal redirect
          }
        }
      } catch (error) {
        // Continue with normal redirect even if invite acceptance fails
      }
    }

    // Redirect based on user role after login
    // This ensures immediate redirect after successful login
    const userRoles = Array.isArray(user?.Roles) ? user.Roles : Array.isArray(user?.roles) ? user.roles : [];
    const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());

    setTimeout(() => {
      if (normalizedRoles.includes('admin')) {
        window.location.replace('/admin/dashboard');
      } else if (normalizedRoles.includes('tenant')) {
        window.location.replace('/tenant/dashboard');
      } else if (normalizedRoles.includes('landlord')) {
        window.location.replace('/landlord/dashboard');
      }
    }, 100);
  };

  const googleLogin = async (accessToken, registrationCode = null, inviteToken = null) => {
    // First, verify the token and check if user exists without creating/login
    // We'll use the google-user-info endpoint to get user info
    try {

      const userInfoResponse = await axios.post('/api/user/google-user-info', {
        accessToken: accessToken
      });


      if (!userInfoResponse.data?.success) {
        const errorMsg = userInfoResponse.data?.message || 'Failed to verify Google token';
        throw new Error(errorMsg);
      }

      const googleUserInfo = userInfoResponse.data?.data;
      console.groupCollapsed('[Google login/signup] /api/user/google-user-info response');
      console.log('success:', userInfoResponse.data?.success);
      console.log('raw data:', googleUserInfo);
      console.log('raw keys:', Object.keys(googleUserInfo || {}));
      console.groupEnd();
      if (!googleUserInfo) {
        throw new Error('Failed to get Google user info');
      }


      // Check if user exists by email
      const emailCheckResponse = await axios.post('/api/user/check-email', {
        email: googleUserInfo.email
      });


      const emailExists = emailCheckResponse.data?.success && emailCheckResponse.data?.data === true;


      if (emailExists) {
        // Existing user - log them in normally
        // Send accessToken, idToken can be null since it's now nullable in the DTO
        const loginResponse = await axios.post('/api/user/google-login', {
          idToken: null, // Null is fine now that DTO field is nullable
          accessToken: accessToken, // Use access token
          registrationCode,
          timezone: getBrowserTimezone()
        });

        if (!loginResponse.data?.success) {
          const errorMsg = loginResponse.data?.message || 'Failed to login with Google';
          throw new Error(errorMsg);
        }

        const user = loginResponse.data?.data;
        const isNewUser = loginResponse.data?.isNewUser || false;

        // Should not be new user if email exists, but handle it anyway
        if (!isNewUser && user) {
          setSession(user.jwtToken);
          dispatch({
            type: LOGIN,
            payload: {
              isLoggedIn: true,
              user
            }
          });
          await ensureBrowserTimezoneSetting();

          // Check for invite tokens in URL and accept them if present
          const urlParams = new URLSearchParams(window.location.search);
          const urlInviteToken = inviteToken || urlParams.get('inviteToken');
          const tenantInviteToken = urlParams.get('tenantInviteToken') || sessionStorage.getItem('tenantInviteToken');

          // Check for organization invite
          if (urlInviteToken) {
            try {
              // Import acceptInvite dynamically to avoid circular dependencies
              const { acceptInvite } = await import('../api/organizationInvite');
              const acceptResponse = await acceptInvite(urlInviteToken);

              if (acceptResponse?.success) {
                // Clear inviteToken from URL
                urlParams.delete('inviteToken');
                const newQuery = urlParams.toString();
                window.history.replaceState({}, '', `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`);
              } else {
              }
            } catch (error) {
              // Continue with normal redirect even if invite acceptance fails
            }
          }

          // Check for tenant invite
          if (tenantInviteToken) {
            try {
              const { acceptTenantInvite } = await import('../api/tenantInvite');
              const email = sessionStorage.getItem('tenantInviteEmail') || user?.email;
              const propertyName = sessionStorage.getItem('tenantInvitePropertyName') || 'the property';

              if (email) {
                const acceptResponse = await tenantInviteAPI.acceptTenantInvite({
                  inviteToken: tenantInviteToken,
                  email: email.trim()
                });

                if (acceptResponse?.success) {
                  // Clear tenant invite data from sessionStorage
                  sessionStorage.removeItem('tenantInviteToken');
                  sessionStorage.removeItem('tenantInviteEmail');
                  sessionStorage.removeItem('pendingTenantInvite');
                  sessionStorage.removeItem('tenantInvitePropertyName');

                  // Clear from URL
                  urlParams.delete('tenantInviteToken');
                  const newQuery = urlParams.toString();
                  window.history.replaceState({}, '', `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`);

                  // Redirect to success page
                  setTimeout(() => {
                    window.location.replace(`/tenant/invite/success?propertyName=${encodeURIComponent(propertyName)}`);
                  }, 100);
                  return; // Don't continue with normal redirect
                } else {
                }
              }
            } catch (error) {
              // Continue with normal redirect even if invite acceptance fails
            }
          }

          // Redirect based on user role after Google login
          const userRoles = Array.isArray(user?.Roles) ? user.Roles : Array.isArray(user?.roles) ? user.roles : [];
          const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());

          setTimeout(() => {
            if (normalizedRoles.includes('admin')) {
              window.location.replace('/admin/dashboard');
            } else if (normalizedRoles.includes('tenant')) {
              window.location.replace('/tenant/dashboard');
            } else if (normalizedRoles.includes('landlord')) {
              window.location.replace('/landlord/dashboard');
            }
          }, 100);
          return;
        }
      }

      // New user - don't log them in, just store data and route to registration

      // Check if user is coming from login page (not registration flow)
      const isFromLoginPage = window.location.pathname === '/login' || window.location.pathname.includes('/login');

      // If coming from login page, redirect to register page to start registration flow
      if (isFromLoginPage) {
        // Store Google token and user info in sessionStorage for registration
        sessionStorage.setItem('googleAccessToken', accessToken);
        sessionStorage.setItem('registerEmail', googleUserInfo.email);
        sessionStorage.setItem('registerFirstName', googleUserInfo.firstName || googleUserInfo.firstname || '');
        sessionStorage.setItem('registerLastName', googleUserInfo.lastName || googleUserInfo.lastname || '');
        const picture = googleUserInfo.picture || googleUserInfo.Picture || '';
        if (picture) sessionStorage.setItem('registerProfileImageUrl', picture);
        // Redirect to register page - user will select account type
        window.location.replace('/register');
        return;
      }

      // Public Google signup is landlord-only. Tenant accounts must originate from invite links.
      const userType = 'landlord';
      sessionStorage.setItem('registerUserType', userType);

      // Store Google token and user info in sessionStorage
      sessionStorage.setItem('googleAccessToken', accessToken);
      sessionStorage.setItem('registerEmail', googleUserInfo.email);
      sessionStorage.setItem('registerFirstName', googleUserInfo.firstName || googleUserInfo.firstname || '');
      sessionStorage.setItem('registerLastName', googleUserInfo.lastName || googleUserInfo.lastname || '');
      const picture = googleUserInfo.picture || googleUserInfo.Picture || '';
      if (picture) sessionStorage.setItem('registerProfileImageUrl', picture);
      // Ensure userType is set in sessionStorage
      sessionStorage.setItem('registerUserType', userType);


      // Public Google signup is landlord-only. Tenant accounts must originate from invite links.
      // Navigate immediately without setTimeout to avoid potential race conditions.
      const googleFirstName = googleUserInfo.firstName || googleUserInfo.FirstName || googleUserInfo.firstname || '';
      const googleLastName = googleUserInfo.lastName || googleUserInfo.LastName || googleUserInfo.lastname || '';
      const nextRegistrationPath = googleFirstName && googleLastName ? '/register/business-info?source=google' : '/register/personal-info?source=google';
      console.log('[Google login/signup] registration redirect decision', {
        email: googleUserInfo.email || googleUserInfo.Email || '',
        firstName: googleFirstName,
        lastName: googleLastName,
        hasPicture: Boolean(googleUserInfo.picture || googleUserInfo.Picture),
        nextRegistrationPath
      });
      window.location.replace(nextRegistrationPath);

      // Return early to prevent any further execution
      return;
    } catch (err) {
      // Enhanced error logging
      const errorMessage = err.response?.data?.message ||
                          err.message ||
                          err.toString() ||
                          'Request failed';
      const errorDetails = {
        message: errorMessage,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        url: err.config?.url,
        method: err.config?.method
      };
      throw new Error(errorMessage);
    }
  };

  const register = async (email, password, firstName, lastName, phoneNumber = null, additionalData = {}) => {
    const requestBody = {
      email: email || '',
      password: password || '',
      firstname: firstName || '',
      lastname: lastName || '',
      phoneNumber: phoneNumber,
      roles: additionalData.roles || ['Landlord'],
      businessName: additionalData.businessName || null,
      businessEmail: additionalData.businessEmail || null,
      businessPhone: additionalData.businessPhone || null,
      googleAccessToken: additionalData.googleAccessToken || null,
      timezone: additionalData.timezone || getBrowserTimezone()
    };


    const response = await axios.post('/api/user/register', requestBody);


    // API returns ServiceResponse<LoadUserDto> with structure: { success: true, data: { ...user data..., jwtToken: "..." }, message: "..." }
    // Note: Backend uses camelCase JSON serialization, so JWTToken becomes jwtToken
    const { data: userData } = response.data;
    const jwtToken = userData?.jwtToken || userData?.JWTToken; // Support both camelCase and PascalCase for compatibility

    // Set session token if provided (same as login)
    if (jwtToken) {
      setSession(jwtToken);
    }

    // Remove jwtToken from user object before storing (same as login)
    const { jwtToken: _, JWTToken: __, ...userWithoutToken } = userData || {};

    // Mark landlord invite as used if present
    const landlordInviteToken = sessionStorage.getItem('landlordInviteToken');
    if (landlordInviteToken) {
      try {
        const landlordInviteAPI = (await import('../api/landlordInvite')).default;
        await landlordInviteAPI.markInviteAsUsed(landlordInviteToken);
        sessionStorage.removeItem('landlordInviteToken');
        sessionStorage.removeItem('landlordInviteEmail');
        sessionStorage.removeItem('landlordInviteFirstName');
        sessionStorage.removeItem('landlordInviteLastName');
      } catch (inviteErr) {
        // Don't fail registration if invite marking fails
      }
    }


    // Dispatch login action with user data
    dispatch({
      type: LOGIN,
      payload: {
        isLoggedIn: true,
        user: userWithoutToken
      }
    });
    await ensureBrowserTimezoneSetting();

    // Handle local users storage for backward compatibility (if needed)
    if (localStorage.getItem('users')) {
      try {
        const localUsers = JSON.parse(localStorage.getItem('users'));
        // Ensure localUsers is an array before spreading
        if (Array.isArray(localUsers)) {
          const updatedUsers = [
            ...localUsers,
            {
              id: userData?.id,
              email: userData?.email,
              name: `${firstName} ${lastName}`
            }
          ];
          localStorage.setItem('users', JSON.stringify(updatedUsers));
        }
      } catch (error) {
        // If parsing fails, clear the corrupted data
        localStorage.removeItem('users');
      }
    }
  };

  const logout = () => {
    // Clear session token and auth headers first
    setSession(null);

    // Clear any other localStorage items that contain user data
    // Keep 'users' for registration and 'mantis-react-ts-config' for theme settings
    const keysToKeep = ['users', 'mantis-react-ts-config'];
    Object.keys(localStorage).forEach((key) => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    // Dispatch LOGOUT action to local auth reducer
    // This sets isInitialized: true and isLoggedIn: false
    dispatch({ type: LOGOUT });

    // Dispatch SIGN_OUT_SUCCESS action to Redux store to update user state
    // This sets loading: false, isAuthenticated: false, and clears user data
    // Use store.dispatch directly since we can't use useDispatch hook here
    try {
      store.dispatch({ type: USER_ACTION_TYPES.SIGN_OUT_SUCCESS });
    } catch (error) {
    }

    // Clear SWR cache to remove all cached API data
    try {
      swrMutate(() => true, undefined, { revalidate: false });
    } catch (error) {
    }

    // Redirect to login page
    window.location.replace('/login');
  };

  const resetPassword = async (email) => {
  };

  const updateProfile = () => {};

  const updateUser = (updates) => {
    dispatch({
      type: UPDATE_USER,
      payload: updates
    });
  };

  const reloadUser = async () => {
    try {
      const response = await axios.get('/api/user/load-user');

      if (response.data && response.data.success && response.data.data) {
        const user = response.data.data;

        dispatch({
          type: UPDATE_USER,
          payload: user
        });

        return user;
      }
    } catch (error) {
      // If 401, token is invalid - logout
      if (error.response?.status === 401) {
        logout();
      }
      throw error;
    }
  };

  if (!state.isInitialized) {
    return <Loader />;
  }

  return (
    <JWTContext.Provider
      value={{
        ...state,
        login,
        googleLogin,
        logout,
        register,
        resetPassword,
        updateProfile,
        updateUser,
        reloadUser
      }}
    >
      {children}
    </JWTContext.Provider>
  );
};

export default JWTContext;
