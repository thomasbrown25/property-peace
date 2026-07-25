import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import store from 'store';
import { logout } from 'store/user/user.action';

const getApiBaseURL = () => {
  const envUrl = import.meta.env.VITE_APP_API_URL;
  const defaultUrl = 'http://localhost:5001/';

  if (!envUrl || envUrl.trim() === '') return defaultUrl;

  const trimmedUrl = envUrl.trim();
  if (trimmedUrl.startsWith(':') || (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://'))) {
    return defaultUrl;
  }

  return trimmedUrl.endsWith('/') ? trimmedUrl : `${trimmedUrl}/`;
};

const axiosServices = axios.create({ baseURL: getApiBaseURL(), withCredentials: true });
const refreshClient = axios.create({ baseURL: getApiBaseURL(), withCredentials: true });
const REFRESH_WINDOW_SECONDS = 2 * 60;
let refreshPromise = null;

export const shouldRefreshToken = (token, windowSeconds = REFRESH_WINDOW_SECONDS) => {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    return !decoded.exp || decoded.exp <= Date.now() / 1000 + windowSeconds;
  } catch (error) {
    return true;
  }
};

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/api/user/refresh')
      .then((response) => {
        const token = response.data?.data?.jwtToken || response.data?.data?.JWTToken;
        if (!token) throw new Error('Refresh response did not include an access token');

        localStorage.setItem('serviceToken', token);
        axiosServices.defaults.headers.common.Authorization = `Bearer ${token}`;
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const handleTokenExpiration = () => {
  localStorage.removeItem('serviceToken');
  localStorage.removeItem('token');
  delete axiosServices.defaults.headers.common.Authorization;
  store.dispatch(logout());

  if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/register')) {
    window.location.href = '/login';
  }
};

const isAuthEndpoint = (url = '') =>
  url.includes('/api/user/login') ||
  url.includes('/api/user/register') ||
  url.includes('/api/user/forgot-password') ||
  url.includes('/api/user/reset-password') ||
  url.includes('/api/user/google-login') ||
  url.includes('/api/user/google-user-info') ||
  url.includes('/api/user/check-email') ||
  url.includes('/api/user/refresh') ||
  url.includes('/api/user/logout') ||
  url.includes('/api/passkey/authentication/') ||
  url.includes('/api/demo-requests');

axiosServices.interceptors.request.use(
  async (config) => {
    const state = store.getState();
    let accessToken = localStorage.getItem('serviceToken') || localStorage.getItem('token') || state.auth?.token;
    const authEndpoint = isAuthEndpoint(config.url);

    if (accessToken && !authEndpoint) {
      if (shouldRefreshToken(accessToken)) {
        try {
          accessToken = await refreshAccessToken();
        } catch (error) {
          handleTokenExpiration();
          return Promise.reject(error);
        }
      }
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (!config.headers['X-Organization-Id'] && !config.headers['x-organization-id']) {
      const currentOrganizationId = localStorage.getItem('currentOrganizationId') || state.auth?.user?.currentOrganizationId;
      if (currentOrganizationId && !authEndpoint) {
        config.headers['X-Organization-Id'] = currentOrganizationId.toString();
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

axiosServices.interceptors.response.use(
  (response) => response,
  async (error) => {
    const authEndpoint = isAuthEndpoint(error.config?.url);
    const isSubscriptionEndpoint = error.config?.url?.includes('/api/subscription');
    const skipAuthRedirect = error.config?.skipAuthRedirect === true;
    const canRefresh =
      error.response?.status === 401 &&
      !authEndpoint &&
      !isSubscriptionEndpoint &&
      !skipAuthRedirect &&
      !error.config?._retry;

    if (canRefresh) {
      error.config._retry = true;
      try {
        const refreshedToken = await refreshAccessToken();
        error.config.headers.Authorization = `Bearer ${refreshedToken}`;
        return axiosServices(error.config);
      } catch (refreshError) {
        handleTokenExpiration();
      }
    }

    const errorData = error.response?.data || {
      message: error.message || 'Request failed',
      status: error.response?.status,
      statusText: error.response?.statusText
    };

    return Promise.reject(errorData);
  }
);

export default axiosServices;

export const fetcher = (url) => axiosServices.get(url).then((response) => response.data);

export const fetcherPost = (url, argOrOpts) => {
  const body =
    argOrOpts && typeof argOrOpts === 'object' && 'arg' in argOrOpts
      ? argOrOpts.arg
      : (argOrOpts ?? {});

  return axiosServices.post(url, body).then((response) => response.data);
};
