import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';
import { User } from '../types/user';

class UserAPI {
  private client = apiClient;

  async loadUser(): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>('/api/user/load-user');
    if (!response?.success || !response.data) throw new Error(response?.message || 'Could not load account.');
    return response.data;
  }

  async updateAccount(details: { firstName: string; lastName: string; email: string; phoneNumber: string; businessName: string; businessEmail: string; businessPhone: string }): Promise<User> {
    const response = await this.client.put<ApiResponse<User>>('/api/user/update-account', details);
    if (!response?.success || !response.data) throw new Error(response?.message || 'Account changes were not confirmed.');
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await this.client.post<ApiResponse<string>>('/api/user/change-password', { currentPassword, newPassword });
    if (!response?.success) throw new Error(response?.message || 'Password change was not confirmed.');
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    const response = await this.client.put<ApiResponse<User>>(`/api/user/${userId}`, userData);
    return response.data;
  }

  async getUserSettings(): Promise<any> {
    const response = await this.client.get<ApiResponse>('/api/user/settings');
    if (!response?.success || !response.data) throw new Error(response?.message || 'General settings could not be loaded.');
    return response.data;
  }

  async saveUserSettings(settings: any): Promise<any> {
    const response = await this.client.post<ApiResponse>('/api/user/settings', settings);
    if (!response?.success || !response.data) throw new Error(response?.message || 'General settings were not saved.');
    return response.data;
  }

  async updateTutorialStatus(): Promise<User> {
    const response = await this.client.put<ApiResponse<User>>('/api/user/tutorial-status', { hasSeenTutorial: true });
    return response.data;
  }

  async getNotificationSettings(): Promise<any> {
    const response = await this.client.get<ApiResponse>('/api/user/notification-settings');
    if (!response?.success || !response.data) throw new Error(response?.message || 'Notifications could not be loaded.');
    return response.data;
  }

  async saveNotificationSettings(settings: any): Promise<any> {
    const response = await this.client.post<ApiResponse>('/api/user/notification-settings', settings);
    if (!response?.success || !response.data) throw new Error(response?.message || 'Notifications were not saved.');
    return response.data;
  }

  async uploadProfileImage(image: { uri: string; fileName: string; mimeType: string }): Promise<string> {
    const form = new FormData();
    form.append('file', { uri: image.uri, name: image.fileName, type: image.mimeType } as any);
    const response = await this.client.post<ApiResponse<{ imageUrl: string }>>('/api/user/upload-profile-image', form);
    const url = response?.data?.imageUrl;
    if (!response?.success || typeof url !== 'string' || !url) {
      throw new Error(response?.message || 'The photo could not be saved.');
    }
    return url;
  }

  async deleteAccount(): Promise<void> {
    await this.client.delete('/api/user');
  }
}

export default new UserAPI();
