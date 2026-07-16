import ApiClient from './client.js';

export class GeneralLedgerAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getEntriesByAccount(accountId, startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    return this.client.get(`/api/general-ledger/account/${accountId}${queryString ? '?' + queryString : ''}`);
  }

  async getEntriesByDateRange(startDate, endDate) {
    return this.client.get(`/api/general-ledger/entries?startDate=${startDate}&endDate=${endDate}`);
  }

  async getAccountBalance(accountId, asOfDate = null) {
    const params = new URLSearchParams();
    if (asOfDate) params.append('asOfDate', asOfDate);
    const queryString = params.toString();
    return this.client.get(`/api/general-ledger/account/${accountId}/balance${queryString ? '?' + queryString : ''}`);
  }

  async getAccountBalances(asOfDate = null) {
    const params = new URLSearchParams();
    if (asOfDate) params.append('asOfDate', asOfDate);
    const queryString = params.toString();
    return this.client.get(`/api/general-ledger/balances${queryString ? '?' + queryString : ''}`);
  }

  async createLedgerEntry(entryData) {
    return this.client.post('/api/general-ledger/entry', entryData);
  }
}

export default GeneralLedgerAPI;
