import ApiClient from './client.js';

export class FinancialStatementsAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getProfitAndLoss(startDate, endDate) {
    return this.client.get(`/api/financial-statements/profit-loss?startDate=${startDate}&endDate=${endDate}`);
  }

  async getBalanceSheet(asOfDate) {
    return this.client.get(`/api/financial-statements/balance-sheet?asOfDate=${asOfDate}`);
  }

  async getCashFlow(startDate, endDate) {
    return this.client.get(`/api/financial-statements/cash-flow?startDate=${startDate}&endDate=${endDate}`);
  }
}

export default FinancialStatementsAPI;
