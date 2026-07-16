import ApiClient from './client.js';

export class StaffMemberAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getStaffMembers() {
    return this.client.get('/api/staff-member');
  }

  async getStaffMemberById(staffMemberId) {
    return this.client.get(`/api/staff-member/${staffMemberId}`);
  }

  async getStaffMemberByUserId(userId) {
    return this.client.get(`/api/staff-member/user/${userId}`);
  }

  async addStaffMember(data) {
    return this.client.post('/api/staff-member', data);
  }

  async updateStaffMember(staffMemberId, data) {
    return this.client.put(`/api/staff-member/${staffMemberId}`, data);
  }

  async deleteStaffMember(staffMemberId) {
    return this.client.delete(`/api/staff-member/${staffMemberId}`);
  }

  // Staff Member Invite methods
  async createInvite(staffMemberId, email) {
    return this.client.post('/api/staff-member-invite', {
      staffMemberId,
      email
    });
  }

  async getInvitesByStaffMemberId(staffMemberId) {
    return this.client.get(`/api/staff-member-invite/staff-member/${staffMemberId}`);
  }
}

export default StaffMemberAPI;
