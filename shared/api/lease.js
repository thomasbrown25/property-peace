import ApiClient from './client.js';

export class LeaseAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async addOrUpdateLease(leaseData) {
    return this.client.post('/api/Lease', leaseData);
  }

  async sendLeaseForSignature(leaseId, signatureRequest) {
    return this.client.post(`/api/Lease/${leaseId}/send-for-signature`, signatureRequest);
  }

  async getLeaseSignatureStatus(leaseId) {
    return this.client.get(`/api/Lease/${leaseId}/signature-status`);
  }

  async cancelLeaseSignature(leaseId, reason = null) {
    return this.client.post(`/api/Lease/${leaseId}/cancel-signature`, reason);
  }

  async resendLeaseSignature(leaseId) {
    return this.client.post(`/api/Lease/${leaseId}/resend-signature`);
  }
}

export default LeaseAPI;
