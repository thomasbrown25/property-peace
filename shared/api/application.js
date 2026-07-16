import ApiClient from './client.js';

export class ApplicationAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async addApplication(application) {
    return this.client.post('/api/Application', application);
  }

  async getApplication(id) {
    return this.client.get(`/api/Application/${id}`);
  }

  async getApplicationsByLandlord(landlordId) {
    return this.client.get(`/api/Application/landlord/${landlordId}`);
  }

  async getApplicationsByProperty(propertyId) {
    return this.client.get(`/api/Application/property/${propertyId}`);
  }

  async getApplicationsByStatus(status) {
    return this.client.get(`/api/Application/status/${status}`);
  }

  async updateApplication(id, application) {
    return this.client.put(`/api/Application/${id}`, application);
  }

  async updateApplicationStatus(id, status, rejectionReason = null, reviewNotes = null) {
    return this.client.put(`/api/Application/${id}/status`, {
      status,
      rejectionReason,
      reviewNotes
    });
  }

  async deleteApplication(id) {
    return this.client.delete(`/api/Application/${id}`);
  }

  async downloadApplicationPdf(id) {
    return this.client.get(`/api/Application/${id}/pdf`, {
      responseType: 'blob'
    });
  }

  async generateApplicationPdf(id) {
    return this.client.post(`/api/Application/${id}/generate-pdf`);
  }

  async getTenantApplications() {
    return this.client.get('/api/Application/tenant/my-applications');
  }

  async requestBackgroundCheck(applicationId, screeningPackage = 'full') {
    return this.client.post(`/api/Application/${applicationId}/background-check`, {
      applicationId,
      screeningPackage
    });
  }

  async getBackgroundCheckStatus(applicationId) {
    return this.client.get(`/api/Application/${applicationId}/background-check`);
  }
}

export default ApplicationAPI;
