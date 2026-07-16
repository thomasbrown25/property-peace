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
}

export default AIFollowUpAPI;
