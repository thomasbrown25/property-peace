import apiClient from '../services/apiClient';
import { ApiResponse, PaginatedResponse } from '../types';

interface Message {
  id: string;
  [key: string]: any;
}

class MessageAPI {
  private client = apiClient;

  async getMessages(conversationId: string, skip: number = 0, take: number = 50): Promise<Message[]> {
    const response = await this.client.get<ApiResponse<Message[]>>(
      `/api/Message/conversation/${conversationId}?skip=${skip}&take=${take}`
    );
    return response.data;
  }

  async getMessage(messageId: string): Promise<Message> {
    const response = await this.client.get<ApiResponse<Message>>(`/api/Message/${messageId}`);
    return response.data;
  }

  async addMessage(data: Partial<Message>): Promise<Message> {
    const response = await this.client.post<ApiResponse<Message>>('/api/Message', data);
    return response.data;
  }

  async updateMessage(messageId: string, content: any): Promise<Message> {
    const response = await this.client.put<ApiResponse<Message>>(`/api/Message/${messageId}`, content);
    return response.data;
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.client.delete(`/api/Message/${messageId}`);
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    await this.client.post(`/api/Message/${messageId}/read`);
  }

  async markConversationAsRead(conversationId: string): Promise<void> {
    await this.client.post(`/api/Message/conversation/${conversationId}/read`);
  }
}

export default new MessageAPI();
