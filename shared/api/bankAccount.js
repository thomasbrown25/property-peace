import ApiClient from './client.js';

export class BankAccountAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getBankAccounts() {
    return this.client.get('/api/bank-accounts');
  }

  async getBankAccount(id) {
    return this.client.get(`/api/bank-accounts/${id}`);
  }

  async createBankAccount(bankAccount) {
    return this.client.post('/api/bank-accounts', bankAccount);
  }

  async updateBankAccount(id, bankAccount) {
    return this.client.put(`/api/bank-accounts/${id}`, bankAccount);
  }

  async deleteBankAccount(id) {
    return this.client.delete(`/api/bank-accounts/${id}`);
  }
}

export default BankAccountAPI;
