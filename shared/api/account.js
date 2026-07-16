import ApiClient from './client.js';

export class AccountAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getAccounts() {
    return this.client.get('/api/accounts');
  }

  async getAccountsByType(accountType) {
    return this.client.get(`/api/accounts/type/${accountType}`);
  }

  async getAccountHierarchy() {
    return this.client.get('/api/accounts/hierarchy');
  }

  async getAccount(id) {
    return this.client.get(`/api/accounts/${id}`);
  }

  async createAccount(account) {
    return this.client.post('/api/accounts', account);
  }

  async updateAccount(id, account) {
    return this.client.put(`/api/accounts/${id}`, account);
  }

  async deleteAccount(id) {
    return this.client.delete(`/api/accounts/${id}`);
  }

  async seedStandardAccounts() {
    return this.client.post('/api/accounts/seed');
  }
}

export default AccountAPI;
