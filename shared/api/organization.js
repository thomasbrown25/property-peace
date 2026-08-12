import ApiClient from './client.js';

export class OrganizationAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async createOrganization(name, description) {
    return this.client.post('/api/organization', {
      name,
      description
    });
  }

  async getOrganizationById(organizationId) {
    return this.client.get(`/api/organization/${organizationId}`);
  }

  async getCurrentOrganization() {
    return this.client.get('/api/organization/current');
  }

  async getUserOrganizations() {
    return this.client.get('/api/organization/user/list');
  }

  async updateOrganization(organizationId, name, description) {
    return this.client.put('/api/organization', {
      id: organizationId,
      name,
      description
    });
  }

  async deleteOrganization(organizationId) {
    return this.client.delete(`/api/organization/${organizationId}`);
  }

  async switchOrganization(organizationId) {
    return this.client.post('/api/organization/switch', {
      organizationId
    });
  }

}

export default OrganizationAPI;
