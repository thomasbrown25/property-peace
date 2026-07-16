import ApiClient from './client.js';

export class LeaseTemplateAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getDefaultLeaseTemplate() {
    return this.client.get('/api/LeaseTemplate/default');
  }

  async getLeaseTemplates() {
    return this.client.get('/api/LeaseTemplate');
  }

  async getLeaseTemplate(id) {
    return this.client.get(`/api/LeaseTemplate/${id}`);
  }

  async createLeaseTemplate(template) {
    return this.client.post('/api/LeaseTemplate', template);
  }

  async updateLeaseTemplate(id, template) {
    return this.client.put(`/api/LeaseTemplate/${id}`, template);
  }

  async deleteLeaseTemplate(id) {
    return this.client.delete(`/api/LeaseTemplate/${id}`);
  }

  async setDefaultLeaseTemplate(id) {
    return this.client.post(`/api/LeaseTemplate/${id}/set-default`);
  }

  async ensureDefaultLeaseTemplate() {
    return this.client.post('/api/LeaseTemplate/ensure-default');
  }
}

export default LeaseTemplateAPI;
