import ApiClient from './client.js';

export class AIFollowUpAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async sendAIFollowUp(actionType, entityId, context = null) {
    return this.client.post('/api/AIFollowUp/send', {
      actionType,
      entityId,
      context
    });
  }

  async runOverdueRentSweep() {
    return this.client.post('/api/ai-copilot/agents/overdue-rent-sweep');
  }

  async getCollectionsHistory(page = 1, pageSize = 20) {
    return this.client.get(`/api/ai-copilot/agents/collections-history?page=${page}&pageSize=${pageSize}`);
  }

  async getAgentDashboardSummary() {
    return this.client.get('/api/ai-copilot/agents/dashboard-summary');
  }

  async chat(message, conversationId) {
    return this.client.post('/api/ai-copilot/chat', {
      message,
      ...(conversationId !== undefined && conversationId !== null ? { conversationId } : {})
    });
  }

  async streamChat(message, conversationId, options = {}) {
    return this.client.streamNdjson(
      '/api/ai-copilot/chat/stream',
      {
        message,
        ...(conversationId !== undefined && conversationId !== null ? { conversationId } : {})
      },
      options
    );
  }

  async getConversations(includeArchived = false) {
    return this.client.get(`/api/ai-copilot/conversations?includeArchived=${includeArchived}`);
  }

  async getConversation(id) {
    return this.client.get(`/api/ai-copilot/conversations/${id}`);
  }

  async archiveConversation(id) {
    return this.client.delete(`/api/ai-copilot/conversations/${id}`);
  }

  async confirmAction(id) {
    return this.client.post(`/api/ai-copilot/confirmations/${id}/confirm`);
  }

  async declineAction(id) {
    return this.client.post(`/api/ai-copilot/confirmations/${id}/decline`);
  }
}

export default AIFollowUpAPI;
