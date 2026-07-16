import ApiClient from './client.js';

export class TenantInviteAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async createTenantInvite(inviteData) {
    return this.client.post('/api/tenantinvite', inviteData);
  }

  async validateInviteToken(token) {
    return this.client.get(`/api/tenantinvite/validate/${token}`);
  }

  async getInvitesByTenantId(tenantId) {
    return this.client.get(`/api/tenantinvite/tenant/${tenantId}`);
  }

  async getInvitesByLandlord() {
    return this.client.get('/api/tenantinvite/landlord');
  }

  async deleteInvite(inviteId) {
    return this.client.delete(`/api/tenantinvite/${inviteId}`);
  }

  async resendInvite(inviteId) {
    return this.client.post(`/api/tenantinvite/${inviteId}/resend`);
  }

  async acceptTenantInvite(dto) {
    return this.client.post('/api/tenantinvite/accept', dto);
  }

  async getPendingInvite() {
    return this.client.get('/api/tenantinvite/pending');
  }
}

export default TenantInviteAPI;
