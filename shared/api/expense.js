import ApiClient from './client.js';

export class ExpenseAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getExpenses(filters = {}) {
    const { propertyId, startDate, endDate, category } = filters;
    const params = new URLSearchParams();

    if (propertyId) params.append('propertyId', propertyId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (category) params.append('category', category);

    return this.client.get(`/api/expense?${params.toString()}`);
  }

  async getExpenseById(expenseId) {
    return this.client.get(`/api/expense/${expenseId}`);
  }

  async addExpense(expense) {
    return this.client.post('/api/expense', expense);
  }

  async updateExpense(expenseId, expense) {
    return this.client.put(`/api/expense/${expenseId}`, expense);
  }

  async deleteExpense(expenseId) {
    return this.client.delete(`/api/expense/${expenseId}`);
  }

  async getTotalExpenses(filters = {}) {
    const { propertyId, startDate, endDate } = filters;
    const params = new URLSearchParams();

    if (propertyId) params.append('propertyId', propertyId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.client.get(`/api/expense/total?${params.toString()}`);
  }

  async getUnpaidBills(filter = null) {
    const params = new URLSearchParams();
    if (filter) params.append('filter', filter);
    return this.client.get(`/api/expense/unpaid-bills?${params.toString()}`);
  }

  async markBillAsPaid(expenseId, paidDate) {
    return this.client.post(`/api/expense/${expenseId}/mark-paid`, paidDate);
  }

  async uploadExpenseReceipts(expenseId, files) {
    const formData = new FormData();
    for (const file of files) {
      const fileToUpload = file instanceof File ? file : (file?.file || file);
      if (fileToUpload && fileToUpload instanceof File) {
        formData.append('files', fileToUpload);
      }
    }
    return this.client.post(`/api/expensereceipt/${expenseId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  async getExpenseReceipts(expenseId) {
    return this.client.get(`/api/expensereceipt/${expenseId}`);
  }

  async deleteExpenseReceipt(receiptId) {
    return this.client.delete(`/api/expensereceipt/${receiptId}`);
  }

  async getExpenseReport(filters = {}) {
    const { propertyId, unitId, startDate, endDate, category, vendorId } = filters;
    const params = new URLSearchParams();

    if (propertyId) params.append('propertyId', propertyId);
    if (unitId) params.append('unitId', unitId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (category) params.append('category', category);
    if (vendorId) params.append('vendorId', vendorId);

    return this.client.get(`/api/expensereport/report?${params.toString()}`);
  }

  async getExpenseReportSummary(filters = {}) {
    const { propertyId, unitId, startDate, endDate, category, vendorId } = filters;
    const params = new URLSearchParams();

    if (propertyId) params.append('propertyId', propertyId);
    if (unitId) params.append('unitId', unitId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (category) params.append('category', category);
    if (vendorId) params.append('vendorId', vendorId);

    return this.client.get(`/api/expensereport/summary?${params.toString()}`);
  }

  async getExpenseTrends(filters = {}) {
    const { propertyId, startDate, endDate, groupBy = 'month' } = filters;
    const params = new URLSearchParams({ groupBy });

    if (propertyId) params.append('propertyId', propertyId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.client.get(`/api/expensereport/trends?${params.toString()}`);
  }

  async getExpenseReportByCategory(filters = {}) {
    const { propertyId, unitId, startDate, endDate } = filters;
    const params = new URLSearchParams();

    if (propertyId) params.append('propertyId', propertyId);
    if (unitId) params.append('unitId', unitId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.client.get(`/api/expensereport/by-category?${params.toString()}`);
  }

  async getPropertyProfitability(filters = {}) {
    const { propertyId, startDate, endDate } = filters;
    const params = new URLSearchParams();

    if (propertyId) params.append('propertyId', propertyId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.client.get(`/api/expensereport/profitability?${params.toString()}`);
  }

  async getIncomeByYear(filters = {}) {
    const { propertyId, year1, year2 } = filters;
    const params = new URLSearchParams();

    if (propertyId) params.append('propertyId', propertyId);
    if (year1) params.append('year1', year1);
    if (year2) params.append('year2', year2);

    return this.client.get(`/api/expensereport/income-by-year?${params.toString()}`);
  }

  async getYearOverYearComparison(filters = {}) {
    const { propertyId, year1, year2 } = filters;
    const params = new URLSearchParams();

    if (propertyId) params.append('propertyId', propertyId);
    if (year1) params.append('year1', year1);
    if (year2) params.append('year2', year2);

    return this.client.get(`/api/expensereport/year-over-year?${params.toString()}`);
  }

  async getTaxYearReport(landlordId, year) {
    const params = new URLSearchParams({ landlordId, year: year.toString() });
    return this.client.get(`/api/taxreport/year-report?${params.toString()}`);
  }

  async getTaxCategorySummary(landlordId, year = null) {
    const params = new URLSearchParams({ landlordId });
    if (year) params.append('year', year.toString());
    return this.client.get(`/api/taxreport/category-summary?${params.toString()}`);
  }

  async getTaxDeductibleExpenses(landlordId, filters = {}) {
    const { year, startDate, endDate } = filters;
    const params = new URLSearchParams({ landlordId });
    if (year) params.append('year', year.toString());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.client.get(`/api/taxreport/deductible-expenses?${params.toString()}`);
  }

  async getForm1099Data(landlordId, year) {
    const params = new URLSearchParams({ landlordId, year: year.toString() });
    return this.client.get(`/api/taxreport/form1099?${params.toString()}`);
  }

  async getTaxReadiness(landlordId, year) {
    const params = new URLSearchParams({ landlordId, year: year.toString() });
    return this.client.get(`/api/taxreport/readiness?${params.toString()}`);
  }

  async exportToAccountingSoftware(landlordId, format, filters = {}) {
    const { year, startDate, endDate } = filters;
    const params = new URLSearchParams({ landlordId, format });
    if (year) params.append('year', year.toString());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.client.get(`/api/taxreport/export?${params.toString()}`, {
      responseType: 'blob'
    });
  }
}

export default ExpenseAPI;
