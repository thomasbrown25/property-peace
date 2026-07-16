import ApiClient from '../client.js';

export class AdminUserAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getAllUsers(includeDeleted = false) {
    return this.client.get(`/api/admin/user/all?includeDeleted=${includeDeleted}`);
  }

  async deleteUser(userId) {
    return this.client.delete(`/api/admin/user/${userId}`);
  }

  async updateUser(userId, userData) {
    return this.client.put(`/api/admin/user/${userId}`, userData);
  }

  async suspendUser(userId) {
    return this.client.post(`/api/admin/user/${userId}/suspend`);
  }

  async unsuspendUser(userId) {
    return this.client.post(`/api/admin/user/${userId}/unsuspend`);
  }
}

export default AdminUserAPI;
