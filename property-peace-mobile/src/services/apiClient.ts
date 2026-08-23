import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { jwtDecode } from 'jwt-decode';
import config from '../config';
import storageService from './storageService';

class ApiClient {
  private httpClient: AxiosInstance;
  private onTokenExpiredCallback?: () => void;

  constructor() {
    this.httpClient = axios.create({
      baseURL: config.API_URL,
      // verify-code issues an HttpOnly proof consumed by register.
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  setOnTokenExpired(callback: () => void) {
    this.onTokenExpiredCallback = callback;
  }

  private isAuthEndpoint(url?: string): boolean {
    if (!url) return false;
    return (
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

        // Add auth token if available and not auth endpoint
        if (token && !isAuthEndpoint) {
          const expired = await this.isTokenExpired(token);
          if (expired) {
            this.onTokenExpiredCallback?.();
            throw new Error('Token expired');
          }
          axiosConfig.headers.Authorization = `Bearer ${token}`;
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

        // Handle 401 errors
        if (error.response?.status === 401 && !isAuthEndpoint && !isSubscriptionEndpoint) {
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
          // For file uploads, let axios set Content-Type
          config.data = data;
          if (config.headers) {
            delete config.headers['Content-Type'];
          }
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
