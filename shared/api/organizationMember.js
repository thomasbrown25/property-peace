import ApiClient from './client.js';

export class OrganizationMemberAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async addMember(organizationId, userId, role) {
    return this.client.post('/api/organization/members', {
      organizationId,
      userId,
      role
    });
  }

  async getMembers(organizationId) {
    return this.client.get(`/api/organization/members/${organizationId}`);
  }

  async updateMember(memberId, role, permissions) {
    return this.client.put('/api/organization/members', {
      id: memberId,
      role,
      ...permissions
    });
  }

  async removeMember(organizationId, memberUserId) {
    return this.client.delete(`/api/organization/members/${organizationId}/${memberUserId}`);
  }

  async checkPermission(organizationId, permission) {
    return this.client.get(`/api/organization/members/permission/${organizationId}?permission=${permission}`);
  }
}

export default OrganizationMemberAPI;
