import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { jwtDecode } from 'jwt-decode';
import config from '../config';
import storageService from './storageService';

class ApiClient {
  private httpClient: AxiosInstance;
  private onTokenExpiredCallback?: () => void;
  private refreshPromise: Promise<string> | null = null;
  private sessionGeneration = 0;

  constructor() {
    this.httpClient = axios.create({
      baseURL: config.API_URL,
      // verify-code issues an HttpOnly proof consumed by register.
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'X-PP-Mobile-Session': 'persistent',
      },
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  setOnTokenExpired(callback: () => void) {
    this.onTokenExpiredCallback = callback;
  }

  invalidateSession() {
    // A refresh already in flight must never restore credentials after explicit sign-out.
    this.sessionGeneration += 1;
  }

  async refreshSession(): Promise<{ jwtToken: string; [key: string]: any }> {
    if (!this.refreshPromise) {
      const generation = this.sessionGeneration;
      const pending = (async () => {
        // Use a bare client: the expired access token must not block the cookie refresh.
        const response = await axios.post<{ success: boolean; data?: { jwtToken?: string; [key: string]: any } }>(
          `${config.API_URL}/api/user/refresh`, {}, { withCredentials: true, timeout: 30000 },
        );
        const user = response.data?.data;
        if (!response.data?.success || !user?.jwtToken) throw new Error('Refresh did not return a session');
        const cached = await storageService.getUser<{ id?: string | number; Id?: string | number }>();
        const cachedId = cached?.id ?? cached?.Id;
        const refreshedId = user.id ?? user.Id;
        if (cachedId != null && String(cachedId) !== String(refreshedId)) {
          throw new Error('Refresh returned a different account');
        }
        if (refreshedId == null || generation !== this.sessionGeneration) {
          throw new Error('Refresh session is no longer valid');
        }
        await storageService.setToken(user.jwtToken);
        if (generation !== this.sessionGeneration) {
          await storageService.removeToken();
          throw new Error('Refresh session is no longer valid');
        }
        await storageService.setUser(user);
        if (generation !== this.sessionGeneration) {
          await storageService.clearAuthData();
          throw new Error('Refresh session is no longer valid');
        }
        return user.jwtToken;
      })();
      this.refreshPromise = pending;
      void pending.finally(() => {
        if (this.refreshPromise === pending) this.refreshPromise = null;
      }).catch(() => {});
    }
    const token = await this.refreshPromise;
    const user = await storageService.getUser<{ jwtToken: string; [key: string]: any }>();
    if (!user || user.jwtToken !== token) throw new Error('Refreshed user is unavailable');
    return user;
  }

  private isAuthEndpoint(url?: string): boolean {
    if (!url) return false;
    return (
      url.includes('/api/user/refresh') ||
      url.includes('/api/user/logout') ||
      url.includes('/api/user/login') ||
      url.includes('/api/user/register') ||
      url.includes('/api/user/forgot-password') ||
      url.includes('/api/user/reset-password') ||
      url.includes('/api/user/google-login') ||
      url.includes('/api/user/apple-login') ||
      url.includes('/api/mfa/login/verify') ||
      url.includes('/api/user/google-user-info') ||
      url.includes('/api/user/check-email') ||
      url.includes('/api/user/send-verification-code') ||
      url.includes('/api/user/verify-code') ||
      url.includes('/api/demo-requests')
    );
  }

  private async isTokenExpired(token: string): Promise<boolean> {
    if (!token) return true;
    try {
      const decoded = jwtDecode<{ exp: number }>(token);
      return decoded.exp < Date.now() / 1000;
    } catch (e) {
      return true;
    }
  }

  private setupInterceptors() {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      async (axiosConfig) => {
        const token = await storageService.getToken();
        const organizationId = await storageService.getCurrentOrganizationId();
        const isAuthEndpoint = this.isAuthEndpoint(axiosConfig.url);

        // Refresh a short-lived access token before sending protected requests.
        if (token && !isAuthEndpoint) {
          const expired = await this.isTokenExpired(token);
          let validToken = token;
          if (expired) {
            try {
              validToken = (await this.refreshSession()).jwtToken;
            } catch (refreshError: any) {
              if (refreshError?.response?.status === 401) this.onTokenExpiredCallback?.();
              throw refreshError;
            }
          }
          axiosConfig.headers.Authorization = `Bearer ${validToken}`;
        }

        // Add organization header if available
        if (organizationId && !isAuthEndpoint) {
          axiosConfig.headers['X-Organization-Id'] = organizationId;
        }

        return axiosConfig;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const isAuthEndpoint = this.isAuthEndpoint(error.config?.url);
        const isSubscriptionEndpoint = error.config?.url?.includes('/api/subscription');

        // Retry one unauthorized protected request after rotating the cookie session.
        const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
        if (error.response?.status === 401 && !isAuthEndpoint && !isSubscriptionEndpoint && original && !original._retry) {
          original._retry = true;
          try {
            const currentToken = await storageService.getToken();
            const sentToken = String(original.headers?.Authorization ?? '').replace(/^Bearer /, '');
            if (!currentToken || currentToken === sentToken) await this.refreshSession();
            return await this.httpClient.request(original);
          } catch (refreshError: any) {
            if (refreshError?.response?.status === 401) this.onTokenExpiredCallback?.();
            return Promise.reject(refreshError);
          }
        }

        if (error.response?.status === 401 && !isAuthEndpoint && !isSubscriptionEndpoint && original?._retry) {
          this.onTokenExpiredCallback?.();
        }

        // Return detailed error
        const errorData = error.response?.data || {
          message: error.message || 'Request failed',
          status: error.response?.status,
          statusText: error.response?.statusText,
        };

        return Promise.reject(errorData);
      }
    );
  }

  async request<T = any>(method: string, url: string, data?: any, options?: AxiosRequestConfig): Promise<T> {
    try {
      const config: AxiosRequestConfig = {
        ...options,
        method,
        url,
      };

      if (data) {
        if (data instanceof FormData) {
          config.data = data;
          config.headers = { ...config.headers, 'Content-Type': undefined };
        } else {
          config.data = data;
        }
      }

      const response: AxiosResponse<T> = await this.httpClient.request(config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  get<T = any>(url: string, options?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('GET', url, undefined, options);
  }

  post<T = any>(url: string, data?: any, options?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('POST', url, data, options);
  }

  put<T = any>(url: string, data?: any, options?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('PUT', url, data, options);
  }

  delete<T = any>(url: string, options?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('DELETE', url, undefined, options);
  }
}

export default new ApiClient();
