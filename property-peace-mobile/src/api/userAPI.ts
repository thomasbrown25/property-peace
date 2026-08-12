import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';
import { User } from '../types/user';

class UserAPI {
  private client = apiClient;

  async loadUser(): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>('/api/user/load-user');
    return response.data;
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    const response = await this.client.put<ApiResponse<User>>(`/api/user/${userId}`, userData);
    return response.data;
  }

  async getUserSettings(): Promise<any> {
    const response = await this.client.get<ApiResponse>('/api/user/settings');
    return response.data;
  }

  async saveUserSettings(settings: any): Promise<any> {
    const response = await this.client.post<ApiResponse>('/api/user/settings', settings);
    return response.data;
  }

  async updateTutorialStatus(): Promise<User> {
    const response = await this.client.put<ApiResponse<User>>('/api/user/tutorial-status', { hasSeenTutorial: true });
    return response.data;
  }

  async getNotificationSettings(): Promise<any> {
    const response = await this.client.get<ApiResponse>('/api/user/notification-settings');
    return response.data;
  }

  async saveNotificationSettings(settings: any): Promise<any> {
    const response = await this.client.post<ApiResponse>('/api/user/notification-settings', settings);
    return response.data;
  }

  async deleteAccount(): Promise<void> {
    await this.client.delete('/api/user');
  }
}

export default new UserAPI();
