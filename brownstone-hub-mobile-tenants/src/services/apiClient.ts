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
      url.includes('/api/user/google-user-info') ||
      url.includes('/api/user/check-email') ||
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
        let organizationId = await storageService.getCurrentOrganizationId();
        const isAuthEndpoint = this.isAuthEndpoint(axiosConfig.url);

        // Ensure headers object exists first
        if (!axiosConfig.headers) {
          axiosConfig.headers = {};
        }

        // If organizationId not in storage, try to get it from user object
        if (!organizationId && !isAuthEndpoint) {
          const user = await storageService.getUser();
          // Check multiple possible property names (camelCase, PascalCase, etc.)
          const orgId = user?.currentOrganizationId || 
                       user?.CurrentOrganizationId || 
                       user?.organizationId || 
                       user?.OrganizationId;
          
          if (orgId) {
            organizationId = String(orgId);
            // Save it for future requests
            await storageService.setCurrentOrganizationId(organizationId);
            console.log('✅ Retrieved organizationId from user object:', organizationId);
          } else {
            console.warn('⚠️ Organization ID not found in storage or user object');
          }
        }

        // Add auth token if available and not auth endpoint
        if (token && !isAuthEndpoint) {
          const expired = await this.isTokenExpired(token);
          if (expired) {
            this.onTokenExpiredCallback?.();
            throw new Error('Token expired');
          }
          axiosConfig.headers.Authorization = `Bearer ${token}`;
        }

        // Add organization header if available - REQUIRED for most endpoints
        // Match web app behavior: set header directly, let axios handle Content-Type for FormData
        if (organizationId && !isAuthEndpoint) {
          // Set header exactly as web app does
          axiosConfig.headers['X-Organization-Id'] = organizationId.toString();
          
          // Log for maintenance requests to help debug
          if (axiosConfig.url?.includes('maintenance-request')) {
            console.log('📤 Sending maintenance request with organizationId:', organizationId);
            console.log('📤 Headers being sent:', {
              'X-Organization-Id': axiosConfig.headers['X-Organization-Id'],
              'Authorization': axiosConfig.headers.Authorization ? 'Bearer ***' : undefined,
            });
          }
        } else if (!isAuthEndpoint) {
          // Log warning if organizationId is missing for non-auth endpoints
          console.warn('⚠️ Organization ID not found for request:', axiosConfig.url);
          console.warn('⚠️ This may cause the request to fail with "Organization context is required"');
        }

        // Handle FormData - remove Content-Type to let axios set it with boundary
        // Do this AFTER setting other headers to ensure they're preserved
        if (axiosConfig.data instanceof FormData) {
          // Remove Content-Type header - axios will set it automatically with boundary
          delete axiosConfig.headers['Content-Type'];
          delete axiosConfig.headers['content-type'];
        }

        // Log request details for debugging (especially for Google login)
        if (axiosConfig.url?.includes('google-login')) {
          console.log('📤 API Request:', {
            method: axiosConfig.method?.toUpperCase(),
            url: axiosConfig.url,
            baseURL: axiosConfig.baseURL,
            data: axiosConfig.data,
            headers: {
              'Content-Type': axiosConfig.headers['Content-Type'],
              'Authorization': axiosConfig.headers.Authorization ? 'Bearer ***' : undefined,
            },
          });
        }

        return axiosConfig;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        // Log successful responses for Google login
        if (response.config.url?.includes('google-login')) {
          console.log('✅ API Response:', {
            status: response.status,
            data: response.data,
          });
        }
        return response;
      },
      async (error) => {
        const isAuthEndpoint = this.isAuthEndpoint(error.config?.url);
        const isSubscriptionEndpoint = error.config?.url?.includes('/api/subscription');

        // Log errors for Google login
        if (error.config?.url?.includes('google-login')) {
          console.error('❌ API Error:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
            requestData: error.config?.data,
          });
        }

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
          // For file uploads in React Native, we need to ensure headers are properly set
          config.data = data;
          // Initialize headers if not present
          if (!config.headers) {
            config.headers = {};
          }
          // Remove Content-Type to let axios set it automatically with boundary
          // This is critical for multipart/form-data to work correctly
          delete config.headers['Content-Type'];
          delete config.headers['content-type'];
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
