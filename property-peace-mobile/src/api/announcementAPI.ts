import apiClient from '../services/apiClient';
import type { ApiResponse } from '../types';

export interface Announcement {
  id: number;
  title: string;
  message: string;
  formattedMessage?: string | null;
  organizationName?: string;
  createdByName?: string;
  sendAsNotification: boolean;
  sendAsEmail: boolean;
  sentCount: number;
  failedCount: number;
  isCompleted: boolean;
  completedAt?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  organizationIds?: string | null;
  propertyIds?: string | null;
  unitIds?: string | null;
  [key: string]: unknown;
}

const unwrap = <T>(response: ApiResponse<T> | T): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    const envelope = response as ApiResponse<T>;
    if ('success' in envelope && !envelope.success) throw new Error('Could not load announcements');
    return envelope.data;
  }
  return response as T;
};

const announcementAPI = {
  async list(): Promise<Announcement[]> {
    const data = unwrap(await apiClient.get<ApiResponse<Announcement[]> | Announcement[]>('/api/announcement'));
    if (!Array.isArray(data)) throw new Error('Invalid announcement list');
    return data;
  },
  async detail(id: number): Promise<Announcement> {
    const data = unwrap(await apiClient.get<ApiResponse<Announcement> | Announcement>(`/api/announcement/${id}`));
    if (!data || typeof data !== 'object') throw new Error('Invalid announcement');
    return data;
  },
  async previewRecipients(): Promise<{ userId: number }[]> {
    const data = unwrap(await apiClient.post<ApiResponse<{ userId: number }[]> | { userId: number }[]>('/api/announcement/recipients/preview', {}));
    if (!Array.isArray(data)) throw new Error('Invalid recipient preview');
    return data;
  },
  async send(message: string, sendEmail: boolean, sendNotification: boolean): Promise<void> {
    unwrap(await apiClient.post<ApiResponse<unknown>>('/api/announcement/send', {
      propertyIds: null, unitIds: null, message, sendEmail, sendNotification,
    }));
  },
};

export default announcementAPI;
