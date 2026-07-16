import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

export interface AppNotification {
  id: string | number;
  title?: string;
  message?: string;
  isRead?: boolean;
  createdAt?: string;
  type?: string | number;
  relatedId?: string | number;
  [key: string]: any;
}

class NotificationAPI {
  private client = apiClient;

  async getNotifications(): Promise<AppNotification[]> {
    const response = await this.client.get<ApiResponse<{ notifications?: AppNotification[] } | AppNotification[]>>('/api/notifications/list');
    const data = response.data as any;
    return data?.notifications || data?.items || data || [];
  }

  async getUnreadCount(): Promise<number> {
    const response = await this.client.get<ApiResponse<number>>('/api/notifications/unread-count');
    return response.data || 0;
  }

  async markRead(notificationId: string | number): Promise<void> {
    await this.client.post(`/api/notifications/mark-read/${notificationId}`);
  }

  async markAllRead(): Promise<void> {
    await this.client.post('/api/notifications/mark-all-read');
  }
}

export default new NotificationAPI();
