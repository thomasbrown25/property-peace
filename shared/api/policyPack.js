import ApiClient from './client.js';

export class PolicyPackAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getDefaultPolicyPack() {
    return this.client.get('/api/PolicyPack/default');
  }

  async getPolicyPacks() {
    return this.client.get('/api/PolicyPack');
  }

  async getPolicyPack(id) {
    return this.client.get(`/api/PolicyPack/${id}`);
  }

  async getPolicyPackItems(id) {
    const response = await this.client.get(`/api/PolicyPack/${id}/items`);
    return response?.items || response?.Items || [];
  }

  async createPolicyPack(policyPack) {
    return this.client.post('/api/PolicyPack', policyPack);
  }

  async updatePolicyPack(id, policyPack) {
    return this.client.put(`/api/PolicyPack/${id}`, policyPack);
  }

  async deletePolicyPack(id) {
    return this.client.delete(`/api/PolicyPack/${id}`);
  }
}

export default PolicyPackAPI;
