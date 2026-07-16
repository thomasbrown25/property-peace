import ApiClient from './client.js';

export class ConversationAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getConversations(includeArchived = false) {
    return this.client.get(`/api/Conversation?includeArchived=${includeArchived}`);
  }

  async getConversation(conversationId) {
    return this.client.get(`/api/Conversation/${conversationId}`);
  }

  async addConversation(data) {
    return this.client.post('/api/Conversation', data);
  }

  async updateConversation(conversationId, data) {
    return this.client.put(`/api/Conversation/${conversationId}`, data);
  }

  async deleteConversation(conversationId) {
    return this.client.delete(`/api/Conversation/${conversationId}`);
  }

  async archiveConversation(conversationId, archive = true) {
    return this.client.post(`/api/Conversation/${conversationId}/archive`, archive);
  }

  async pinConversation(conversationId, pin = true) {
    return this.client.post(`/api/Conversation/${conversationId}/pin`, pin);
  }

  async getConversationSummary(conversationId) {
    return this.client.get(`/api/Conversation/${conversationId}/summary`);
  }

  async getUrgentConversations() {
    return this.client.get('/api/Conversation/urgent');
  }

  async analyzeConversation(conversationId) {
    return this.client.post(`/api/Conversation/${conversationId}/analyze`);
  }

  async clearUrgentItems(conversationId, urgentItemId = null, messageId = null) {
    const payload = {
      urgentItemId: urgentItemId || null,
      messageId: messageId || null
    };
    return this.client.post(`/api/Conversation/${conversationId}/clear-urgent`, payload);
  }

  async getSuppressedMessageIds() {
    return this.client.get('/api/Conversation/suppressed-messages');
  }

  async getAllUrgentMessageDetails() {
    return this.client.get('/api/Conversation/urgent-messages/all');
  }
}

export default ConversationAPI;
