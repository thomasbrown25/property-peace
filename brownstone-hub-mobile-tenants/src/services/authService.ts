import { jwtDecode } from 'jwt-decode';
import storageService from './storageService';
import apiClient from './apiClient';
import config from '../config';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface User {
  Id: string;
  Email: string;
  FirstName?: string;
  LastName?: string;
  Roles?: string[];
  jwtToken?: string;
  hasSeenTutorial?: boolean;
  currentOrganizationId?: string;
  [key: string]: any;
}

export interface AuthResponse {
  success: boolean;
  data: User;
  message?: string;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<User> {
    try {
      const response = await apiClient.post<AuthResponse>('/api/user/login', credentials);
      const user = response?.data;

      if (user?.jwtToken) {
        await storageService.setToken(user.jwtToken);
        await storageService.setUser(user);
        if (user.currentOrganizationId) {
          await storageService.setCurrentOrganizationId(String(user.currentOrganizationId));
        }
        return user;
      }

      throw new Error('Login failed: No token received');
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error?.message || 'Login failed. Please check your credentials.');
    }
  }

  async register(data: RegisterData): Promise<User> {
    try {
      const response = await apiClient.post<AuthResponse>('/api/user/register', data);
      const user = response?.data;

      if (user?.jwtToken) {
        await storageService.setToken(user.jwtToken);
        await storageService.setUser(user);
        if (user.currentOrganizationId) {
          await storageService.setCurrentOrganizationId(String(user.currentOrganizationId));
        }
        return user;
      }

      throw new Error('Registration failed: No token received');
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error?.message || 'Registration failed. Please try again.');
    }
  }

  async logout(): Promise<void> {
    try {
      await storageService.clearAuthData();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await storageService.getToken();
      if (!token) return false;

      const decoded = jwtDecode<{ exp: number }>(token);
      return decoded.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await storageService.getUser<User>();
      
      // If user exists but token might be expired, verify it
      if (user) {
        const isAuth = await this.isAuthenticated();
        if (!isAuth) {
          // Token expired, try to refresh or return null
          return null;
        }
      }

      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async loadUser(): Promise<User | null> {
    try {
      const isAuth = await this.isAuthenticated();
      if (!isAuth) {
        return null;
      }

      const response = await apiClient.get<{ success: boolean; data: User }>('/api/user/load-user');
      
      if (response?.success && response?.data) {
        const user = response.data;
        await storageService.setUser(user);
        if (user.currentOrganizationId) {
          await storageService.setCurrentOrganizationId(String(user.currentOrganizationId));
        }
        return user;
      }

      return null;
    } catch (error) {
      console.error('Error loading user:', error);
      return null;
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      await apiClient.post('/api/user/forgot-password', { email });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw new Error(error?.message || 'Failed to send reset email.');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await apiClient.post('/api/user/reset-password', { token, newPassword });
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw new Error(error?.message || 'Failed to reset password.');
    }
  }

  async googleLogin(idToken?: string, accessToken?: string, registrationCode?: string): Promise<User> {
    // Google login - backend handles both new and existing users
    return this.socialLogin('Google', idToken, accessToken, registrationCode);
  }

  async appleLogin(idToken?: string, accessToken?: string): Promise<User> {
    // Apple login - backend handles both new and existing users
    return this.socialLogin('Apple', idToken, accessToken);
  }

  async facebookLogin(accessToken?: string): Promise<User> {
    // Facebook login - backend handles both new and existing users
    return this.socialLogin('Facebook', undefined, accessToken);
  }

  private async socialLogin(provider: string, idToken?: string, accessToken?: string, registrationCode?: string): Promise<User> {
    try {
      // Ensure at least one token is provided
      if (!idToken && !accessToken) {
        throw new Error('Either idToken or accessToken must be provided');
      }

      // Build request body, only including properties that have values
      const requestBody: any = {};
      if (idToken) requestBody.idToken = idToken;
      if (accessToken) requestBody.accessToken = accessToken;
      if (registrationCode) requestBody.registrationCode = registrationCode;

      console.log(`🔐 ${provider} Login - Preparing request:`, { 
        hasIdToken: !!idToken, 
        idTokenLength: idToken?.length || 0,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length || 0,
        hasRegistrationCode: !!registrationCode,
        apiUrl: config.API_URL,
        requestBody: JSON.stringify(requestBody),
      });

      // Test backend connectivity first
      try {
        const healthCheck = await fetch(`${config.API_URL}health`);
        console.log('🔵 Backend health check:', healthCheck.status);
      } catch (healthError) {
        console.error('❌ Backend not reachable:', healthError);
        throw new Error(`Cannot connect to backend at ${config.API_URL}. Make sure the backend is running and accessible from your device.`);
      }

      // Use provider-specific endpoint (for now, all use google-login until backend supports others)
      const endpoint = provider === 'Google' ? '/api/user/google-login' : '/api/user/google-login';
      const response = await apiClient.post<AuthResponse & { isNewUser?: boolean }>(endpoint, requestBody);
      
      console.log(`✅ ${provider} Login - Response received:`, {
        hasResponse: !!response,
        responseKeys: response ? Object.keys(response) : [],
        hasData: !!response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : [],
        nestedData: !!response?.data?.data,
      });
      
      // Handle nested response structure: response.data.data
      const user = response?.data?.data || response?.data;

      if (user?.jwtToken) {
        await storageService.setToken(user.jwtToken);
        await storageService.setUser(user);
        if (user.currentOrganizationId) {
          await storageService.setCurrentOrganizationId(String(user.currentOrganizationId));
        }
        return user;
      }

      throw new Error(`${provider} login failed: No token received`);
    } catch (error: any) {
      console.error(`${provider} login error:`, error);
      throw new Error(error?.message || `${provider} login failed. Please try again.`);
    }
  }
}

export default new AuthService();
