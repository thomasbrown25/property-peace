import ApiClient from './client.js';

export class MessageAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getMessages(conversationId, skip = 0, take = 50) {
    return this.client.get(`/api/Message/conversation/${conversationId}?skip=${skip}&take=${take}`);
  }

  async getMessage(messageId) {
    return this.client.get(`/api/Message/${messageId}`);
  }

  async addMessage(data) {
    return this.client.post('/api/Message', data);
  }

  async updateMessage(messageId, content) {
    return this.client.put(`/api/Message/${messageId}`, content);
  }

  async deleteMessage(messageId) {
    return this.client.delete(`/api/Message/${messageId}`);
  }

  async markMessageAsRead(messageId) {
    return this.client.post(`/api/Message/${messageId}/read`);
  }

  async markConversationAsRead(conversationId) {
    return this.client.post(`/api/Message/conversation/${conversationId}/read`);
  }
}

export default MessageAPI;
