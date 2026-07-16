import ApiClient from './client.js';

export class BankReconciliationAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async uploadBankStatement(statementData) {
    return this.client.post('/api/bank-reconciliation/upload', statementData);
  }

  async getUnmatchedTransactions(bankStatementId = null) {
    const params = new URLSearchParams();
    if (bankStatementId) params.append('bankStatementId', bankStatementId);
    const queryString = params.toString();
    return this.client.get(`/api/bank-reconciliation/unmatched-transactions${queryString ? '?' + queryString : ''}`);
  }

  async getUnmatchedLedgerEntries(startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    return this.client.get(`/api/bank-reconciliation/unmatched-ledger-entries${queryString ? '?' + queryString : ''}`);
  }

  async matchTransaction(bankTransactionId, ledgerEntryId) {
    return this.client.post('/api/bank-reconciliation/match', {
      bankTransactionId,
      ledgerEntryId
    });
  }

  async unmatchTransaction(bankTransactionId) {
    return this.client.post('/api/bank-reconciliation/unmatch', {
      bankTransactionId
    });
  }

  async deleteTransaction(bankTransactionId) {
    return this.client.delete(`/api/bank-reconciliation/transaction/${bankTransactionId}`);
  }

  async getReconciliationReport(statementId) {
    return this.client.get(`/api/bank-reconciliation/statement/${statementId}/report`);
  }

  async reconcileStatement(statementId, notes = null) {
    return this.client.post('/api/bank-reconciliation/reconcile', {
      bankStatementId: statementId,
      notes
    });
  }

  async clearUnmatchedTransactions() {
    return this.client.delete('/api/bank-reconciliation/transactions/unmatched');
  }
}

export default BankReconciliationAPI;
