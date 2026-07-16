import ApiClient from './client.js';

export class OrganizationInviteAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async createInvite(organizationId, email, role) {
    return this.client.post('/api/organization/invites', {
      organizationId,
      email,
      role
    });
  }

  async getInvites(organizationId) {
    return this.client.get(`/api/organization/invites/${organizationId}`);
  }

  async getInviteByToken(token) {
    return this.client.get(`/api/organization/invites/token/${token}`);
  }

  async acceptInvite(token) {
    return this.client.post('/api/organization/invites/accept', {
      token
    });
  }

  async deleteInvite(inviteId) {
    return this.client.delete(`/api/organization/invites/${inviteId}`);
  }

  async resendInvite(inviteId) {
    return this.client.post(`/api/organization/invites/${inviteId}/resend`);
  }

  async getPendingInvites() {
    return this.client.get('/api/organization/invites/pending');
  }
}

export default OrganizationInviteAPI;
