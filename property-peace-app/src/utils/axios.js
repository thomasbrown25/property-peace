import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import store from 'store';
import { logout } from 'store/user/user.action';

// Helper function to normalize the API URL
const getApiBaseURL = () => {
  const envUrl = import.meta.env.VITE_APP_API_URL;
  const defaultUrl = 'http://localhost:5001/';
  
  // If no env URL or empty string, use default
  if (!envUrl || envUrl.trim() === '') {
    return defaultUrl;
  }
  
  const trimmedUrl = envUrl.trim();
  
  // If URL doesn't start with http:// or https://, it's malformed
  // Check if it starts with : (like :5001) or just a port
  if (trimmedUrl.startsWith(':') || (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://'))) {
    return defaultUrl;
  }
  
  // For localhost, ensure we use HTTP unless explicitly HTTPS
  // This prevents SSL protocol errors when backend only serves HTTP
  if (trimmedUrl.includes('localhost') && trimmedUrl.startsWith('https://')) {
    // Only use HTTPS if explicitly set and not just the default
    // For development, prefer HTTP
  }
  
  // Ensure URL ends with /
  const finalUrl = trimmedUrl.endsWith('/') ? trimmedUrl : `${trimmedUrl}/`;
  return finalUrl;
};

const axiosServices = axios.create({ baseURL: getApiBaseURL() });

// ==============================|| AXIOS - FOR MOCK SERVICES ||============================== //

/**
 * Check if a JWT token is expired
 */
const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
    return decoded.exp < Date.now() / 1000;
  } catch (e) {
    return true; // If we can't decode, consider it expired
  }
};

/**
 * Handle token expiration by logging out and redirecting
 */
const handleTokenExpiration = () => {
  store.dispatch(logout());
  // Redirect to login page when token is expired
  if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/register')) {
    window.location.href = '/login';
  }
};

axiosServices.interceptors.request.use(
  async (config) => {
    const state = store.getState();
    const accessToken = state.auth?.token || localStorage.getItem('serviceToken') || localStorage.getItem('token');

    // Skip token expiration check and token header for login/register endpoints and public endpoints
    const isAuthEndpoint = config.url?.includes('/api/user/login') || 
                          config.url?.includes('/api/user/register') ||
                          config.url?.includes('/api/user/forgot-password') ||
                          config.url?.includes('/api/user/reset-password') ||
                          config.url?.includes('/api/user/google-login') ||
                          config.url?.includes('/api/user/google-user-info') ||
                          config.url?.includes('/api/user/check-email') ||
                          config.url?.includes('/api/demo-requests');

    // Proactively check if token is expired before making the request
    // But skip this check for authentication endpoints (login, register, etc.)
    if (accessToken && !isAuthEndpoint) {
      if (isTokenExpired(accessToken)) {
        handleTokenExpiration();
        return Promise.reject(new Error('Token expired'));
      }
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    // Add organization context header if available
    // Only set if not already explicitly set in the request (e.g., for announcement recipient selection)
    // Prioritize localStorage (set by OrganizationContext) over Redux store
    if (!config.headers['X-Organization-Id'] && !config.headers['x-organization-id']) {
      const currentOrganizationId = localStorage.getItem('currentOrganizationId') || state.auth?.user?.currentOrganizationId;
      if (currentOrganizationId && !isAuthEndpoint) {
        config.headers['X-Organization-Id'] = currentOrganizationId.toString();
      }
    }
    
    // For auth endpoints, don't add token header at all - these endpoints don't require authentication
    return config;
  },
  (error) => Promise.reject(error)
);

axiosServices.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't handle 401 as token expiration for login/register endpoints
    // These endpoints can legitimately return 401 for invalid credentials
    const isAuthEndpoint = error.config?.url?.includes('/api/user/login') || 
                          error.config?.url?.includes('/api/user/register') ||
                          error.config?.url?.includes('/api/user/forgot-password') ||
                          error.config?.url?.includes('/api/user/reset-password') ||
                          error.config?.url?.includes('/api/user/google-login') ||
                          error.config?.url?.includes('/api/user/google-user-info') ||
                          error.config?.url?.includes('/api/user/check-email');

    // Don't handle 401 as token expiration for subscription endpoints
    // These endpoints may return 401 for subscription-related issues, not auth issues
    const isSubscriptionEndpoint = error.config?.url?.includes('/api/subscription');

    // Some endpoints call third-party providers that can return their own 401s.
    // Those should surface in the UI instead of logging the user out.
    const skipAuthRedirect = error.config?.skipAuthRedirect === true;

    if (error.response?.status === 401 && !isAuthEndpoint && !isSubscriptionEndpoint && !skipAuthRedirect) {
      handleTokenExpiration();
    }
    
    // Return more detailed error information
    const errorData = error.response?.data || {
      message: error.message || 'Request failed',
      status: error.response?.status,
      statusText: error.response?.statusText
    };
    
    return Promise.reject(errorData);
  }
);

export default axiosServices;

export const fetcher = (url) => axiosServices.get(url).then((r) => r.data);

export const fetcherPost = (url, argOrOpts) => {
  const body =
    argOrOpts && typeof argOrOpts === 'object' && 'arg' in argOrOpts
      ? argOrOpts.arg // SWR mutation: (url, { arg })
      : (argOrOpts ?? {}); // direct call: (url, payload)

  return axiosServices.post(url, body).then((r) => r.data);
};
