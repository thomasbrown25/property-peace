import { jwtDecode } from 'jwt-decode';
import storageService from './storageService';
import apiClient from './apiClient';
import { AuthResult, normalizeAuthResult } from './mfaChallenge';

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
  data?: User;
  message?: string;
  mfaRequired?: boolean;
  mfa?: {
    challengeId?: string;
    method?: string | number;
    maskedPhone?: string | null;
    expiresAt?: string;
  };
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: { message?: string; details?: string };
}

class AuthService {
  private responseError<T>(response: ServiceResponse<T>, fallback: string): Error {
    return new Error(response.message || response.errors?.message || response.errors?.details || fallback);
  }

  async sendRegistrationCode(email: string): Promise<void> {
    const check = await apiClient.post<ServiceResponse<boolean>>('/api/user/check-email', { email });
    if (!check.success) throw this.responseError(check, 'Unable to check that email address.');
    if (check.data === true) throw new Error('An account already exists for this email. Sign in instead.');

    const response = await apiClient.post<ServiceResponse<string>>('/api/user/send-verification-code', { email });
    if (!response.success) throw this.responseError(response, 'Unable to send a verification code.');
  }

  async resendRegistrationCode(email: string): Promise<void> {
    const response = await apiClient.post<ServiceResponse<string>>('/api/user/send-verification-code', { email });
    if (!response.success) throw this.responseError(response, 'Unable to resend the verification code.');
  }

  async verifyRegistrationCode(email: string, code: string): Promise<void> {
    const response = await apiClient.post<ServiceResponse<boolean>>('/api/user/verify-code', { email, code });
    if (!response.success || response.data !== true) {
      throw this.responseError(response, 'That code is invalid or expired.');
    }
    // The success response sets the HttpOnly pp-email-verification proof cookie.
  }

  private async completeAuthentication(user: User): Promise<User> {
    if (!user.jwtToken) {
      throw new Error('The server did not return a valid sign-in session.');
    }

    await storageService.setToken(user.jwtToken);
    await storageService.setUser(user);
    if (user.currentOrganizationId) {
      await storageService.setCurrentOrganizationId(String(user.currentOrganizationId));
    }
    return user;
  }

  async login(credentials: LoginCredentials): Promise<AuthResult<User>> {
    try {
      const response = await apiClient.post<AuthResponse>('/api/user/login', credentials);
      const result = normalizeAuthResult(response);
      if (result.kind === 'challenge') {
        return result;
      }
      return { kind: 'authenticated', user: await this.completeAuthentication(result.user) };
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

  async appleLogin(params: {
    identityToken: string;
    nonce: string;
    firstName?: string;
    lastName?: string;
    timezone?: string;
  }): Promise<AuthResult<User>> {
    try {
      const response = await apiClient.post<AuthResponse & { isNewUser?: boolean }>('/api/user/apple-login', params);
      const result = normalizeAuthResult(response);
      if (result.kind === 'challenge') {
        return result;
      }
      return { kind: 'authenticated', user: await this.completeAuthentication(result.user) };
    } catch (error: any) {
      throw new Error(error?.message || 'Sign in with Apple failed. Please try again.');
    }
  }

  async googleLogin(idToken?: string, accessToken?: string, registrationCode?: string): Promise<AuthResult<User>> {
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

      const response = await apiClient.post<AuthResponse & { isNewUser?: boolean }>('/api/user/google-login', requestBody);
      const result = normalizeAuthResult(response);
      if (result.kind === 'challenge') {
        return result;
      }
      return { kind: 'authenticated', user: await this.completeAuthentication(result.user) };
    } catch (error: any) {
      console.error('Google login error:', error);
      // Extract more detailed error message
      const errorMessage = error?.response?.data?.message || 
                          error?.response?.data?.Message ||
                          error?.message || 
                          'Google login failed. Please try again.';
      throw new Error(errorMessage);
    }
  }

  async verifyMfaLogin(challengeId: string, code: string): Promise<User> {
    try {
      const response = await apiClient.post<AuthResponse>('/api/mfa/login/verify', { challengeId, code });
      const result = normalizeAuthResult(response);
      if (result.kind !== 'authenticated') {
        throw new Error('Multi-factor verification did not return a valid sign-in session.');
      }
      return await this.completeAuthentication(result.user);
    } catch (error: any) {
      throw new Error(error?.message || 'That security code could not be verified.');
    }
  }
}

export default new AuthService();
