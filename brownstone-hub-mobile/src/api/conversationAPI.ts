import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

interface Conversation {
  id: string;
  [key: string]: any;
}

class ConversationAPI {
  private client = apiClient;

  async getConversations(): Promise<Conversation[]> {
    const response = await this.client.get<ApiResponse<Conversation[]>>('/api/Conversation');
    return response.data;
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await this.client.get<ApiResponse<Conversation>>(`/api/Conversation/${conversationId}`);
    return response.data;
  }

  async createConversation(data: Partial<Conversation>): Promise<Conversation> {
    const response = await this.client.post<ApiResponse<Conversation>>('/api/Conversation', data);
    return response.data;
  }

  async updateConversation(conversationId: string, data: Partial<Conversation>): Promise<Conversation> {
    const response = await this.client.put<ApiResponse<Conversation>>(`/api/Conversation/${conversationId}`, data);
    return response.data;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.client.delete(`/api/Conversation/${conversationId}`);
  }
}

export default new ConversationAPI();
