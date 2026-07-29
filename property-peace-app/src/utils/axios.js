import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import store from 'store';
import { logout } from 'store/user/user.action';
import {
  getActiveAccessToken,
  getActiveOrganizationId,
  getImpersonationRefreshToken,
  isImpersonating,
  normalizeImpersonationResponse,
  notifyImpersonationExpired,
  updateImpersonationAccessToken
} from 'utils/impersonationSession';

const getApiBaseURL = () => {
  const envUrl = import.meta.env.VITE_APP_API_URL;
  const defaultUrl = 'http://localhost:5001/';
  if (!envUrl || envUrl.trim() === '') return defaultUrl;
  const trimmedUrl = envUrl.trim();
  if (trimmedUrl.startsWith(':') || (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://'))) return defaultUrl;
  return trimmedUrl.endsWith('/') ? trimmedUrl : `${trimmedUrl}/`;
};

const axiosServices = axios.create({ baseURL: getApiBaseURL(), withCredentials: true });
const refreshClient = axios.create({ baseURL: getApiBaseURL(), withCredentials: true });
const REFRESH_WINDOW_SECONDS = 2 * 60;
let refreshPromise = null;
let impersonationRefreshPromise = null;
let impersonationStatusPromise = null;

export const shouldRefreshToken = (token, windowSeconds = REFRESH_WINDOW_SECONDS) => {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    return !decoded.exp || decoded.exp <= Date.now() / 1000 + windowSeconds;
  } catch {
    return true;
  }
};

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshClient.post('/api/user/refresh').then((response) => {
      const token = response.data?.data?.jwtToken || response.data?.data?.JWTToken;
      if (!token) throw new Error('Refresh response did not include an access token');
      localStorage.setItem('serviceToken', token);
      return token;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

export const refreshImpersonationAccessToken = async () => {
  const refreshToken = getImpersonationRefreshToken();
  if (!refreshToken) throw new Error('Impersonation refresh token is unavailable.');
  if (!impersonationRefreshPromise) {
    impersonationRefreshPromise = refreshClient.post('/api/admin/impersonation/refresh', refreshToken, {
      headers: { 'Content-Type': 'application/json' }
    }).then((response) => {
      const result = normalizeImpersonationResponse(response);
      updateImpersonationAccessToken(
        result.accessToken,
        result.refreshToken,
        result.accessTokenExpiresAt,
        result.sessionExpiresAt
      );
      return result.accessToken;
    }).finally(() => { impersonationRefreshPromise = null; });
  }
  return impersonationRefreshPromise;
};

export const ensureActiveAccessToken = async () => {
  let token = getActiveAccessToken();
  if (!token || shouldRefreshToken(token)) {
    token = isImpersonating() ? await refreshImpersonationAccessToken() : await refreshAccessToken();
  }
  return token;
};

export const checkImpersonationStatus = async () => {
  if (!isImpersonating()) return null;
  if (!impersonationStatusPromise) {
    impersonationStatusPromise = ensureActiveAccessToken()
      .then((token) => refreshClient.get('/api/admin/impersonation/status', {
        headers: { Authorization: `Bearer ${token}` }
      }))
      .then((response) => {
        const status = response.data?.data ?? response.data;
        if (status?.active === false || status?.isActive === false || status?.IsActive === false) {
          throw new Error('Impersonation session is no longer active.');
        }
        return status;
      })
      .finally(() => { impersonationStatusPromise = null; });
  }
  return impersonationStatusPromise;
};

const handleTokenExpiration = () => {
  localStorage.removeItem('serviceToken');
  localStorage.removeItem('token');
  store.dispatch(logout());
  if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/register')) window.location.href = '/login';
};

const isAuthEndpoint = (url = '') =>
  url.includes('/api/user/login') || url.includes('/api/user/register') ||
  url.includes('/api/user/forgot-password') || url.includes('/api/user/reset-password') ||
  url.includes('/api/user/google-login') || url.includes('/api/user/google-user-info') ||
  url.includes('/api/user/check-email') || url.includes('/api/user/refresh') ||
  url.includes('/api/user/logout') || url.includes('/api/passkey/authentication/') || url.includes('/api/mfa/challenges/') ||
  url.includes('/api/mfa/login/verify') ||
  url.includes('/api/demo-requests') || url.includes('/api/admin/impersonation/refresh');

axiosServices.interceptors.request.use(async (config) => {
  const state = store.getState();
  let accessToken = getActiveAccessToken();
  const authEndpoint = isAuthEndpoint(config.url);
  if (accessToken && !authEndpoint) {
    if (shouldRefreshToken(accessToken)) {
      try {
        accessToken = await ensureActiveAccessToken();
      } catch (error) {
        if (isImpersonating()) notifyImpersonationExpired();
        else handleTokenExpiration();
        return Promise.reject(error);
      }
    }
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (!config.headers['X-Organization-Id'] && !config.headers['x-organization-id']) {
    const currentOrganizationId = getActiveOrganizationId(state.auth?.user);
    if (currentOrganizationId && !authEndpoint) config.headers['X-Organization-Id'] = currentOrganizationId.toString();
  }
  return config;
}, (error) => Promise.reject(error));

axiosServices.interceptors.response.use((response) => response, async (error) => {
  const authEndpoint = isAuthEndpoint(error.config?.url);
  const isSubscriptionEndpoint = error.config?.url?.includes('/api/subscription');
  const skipAuthRedirect = error.config?.skipAuthRedirect === true;
  const canRefresh = error.response?.status === 401 && !authEndpoint && !isSubscriptionEndpoint && !skipAuthRedirect && !error.config?._retry;
  if (canRefresh) {
    error.config._retry = true;
    try {
      const refreshedToken = await ensureActiveAccessToken();
      error.config.headers.Authorization = `Bearer ${refreshedToken}`;
      return axiosServices(error.config);
    } catch {
      if (isImpersonating()) notifyImpersonationExpired();
      else handleTokenExpiration();
    }
  }
  return Promise.reject(error.response?.data || {
    message: error.message || 'Request failed',
    status: error.response?.status,
    statusText: error.response?.statusText
  });
});

export default axiosServices;
export const fetcher = (url) => axiosServices.get(url).then((response) => response.data);
export const fetcherPost = (url, argOrOpts) => {
  const body = argOrOpts && typeof argOrOpts === 'object' && 'arg' in argOrOpts ? argOrOpts.arg : (argOrOpts ?? {});
  return axiosServices.post(url, body).then((response) => response.data);
};
