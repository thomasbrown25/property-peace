import ApiClient from './client.js';

export class RecurringExpenseAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getRecurringExpenses(landlordId, filters = {}) {
    const { propertyId } = filters;
    const params = new URLSearchParams({ landlordId });
    
    if (propertyId) params.append('propertyId', propertyId);

    return this.client.get(`/api/recurringexpense?${params.toString()}`);
  }

  async getRecurringExpenseById(recurringExpenseId) {
    return this.client.get(`/api/recurringexpense/${recurringExpenseId}`);
  }

  async addRecurringExpense(recurringExpense) {
    return this.client.post('/api/recurringexpense', recurringExpense);
  }

  async updateRecurringExpense(recurringExpenseId, recurringExpense) {
    return this.client.put(`/api/recurringexpense/${recurringExpenseId}`, recurringExpense);
  }

  async deleteRecurringExpense(recurringExpenseId) {
    return this.client.delete(`/api/recurringexpense/${recurringExpenseId}`);
  }

  async pauseRecurringExpense(recurringExpenseId) {
    return this.client.post(`/api/recurringexpense/${recurringExpenseId}/pause`);
  }

  async resumeRecurringExpense(recurringExpenseId) {
    return this.client.post(`/api/recurringexpense/${recurringExpenseId}/resume`);
  }
}

export default RecurringExpenseAPI;
