import ApiClient from './client.js';

export class ApplicationInviteAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async createApplicationInvite(inviteData) {
    return this.client.post('/api/applicationinvite', inviteData);
  }

  async getApplicationInvitesByProperty(propertyId) {
    return this.client.get(`/api/applicationinvite/property/${propertyId}`);
  }

  async getApplicationInvitesByLandlord() {
    return this.client.get('/api/applicationinvite/landlord');
  }

  async deleteApplicationInvite(inviteId) {
    return this.client.delete(`/api/applicationinvite/${inviteId}`);
  }

  async resendApplicationInvite(inviteId) {
    return this.client.post(`/api/applicationinvite/${inviteId}/resend`);
  }

  async resendApplicationInviteByApplicationId(applicationId) {
    return this.client.post(`/api/applicationinvite/application/${applicationId}/resend`);
  }

  async validateApplicationInviteToken(token) {
    return this.client.get(`/api/applicationinvite/validate/${token}`);
  }

  async submitApplicationWithToken(token, applicationData) {
    return this.client.post(`/api/applicationinvite/submit/${token}`, applicationData);
  }
}

export default ApplicationInviteAPI;
