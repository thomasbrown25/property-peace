import type { AxiosRequestConfig } from 'axios';
import type { ApiResponse } from '../types';
import type { CreateExpensePayload, LocalExpenseReceipt, TaxCategoryWireValue } from '../features/expenses/expenseModel';
import type { EditableExpenseRecord } from '../features/expenses/expenseEdit';

export interface ExpenseRecord {
  id: number;
  name: string;
  amount: number;
  taxCategory: TaxCategoryWireValue | null;
}

export interface ExpenseHttpClient {
  post<T>(url: string, data?: unknown, options?: AxiosRequestConfig): Promise<T>;
  get?<T>(url: string): Promise<T>;
  put?<T>(url: string, data: unknown): Promise<T>;
}

export class ExpenseAPI {
  private readonly client: ExpenseHttpClient;
  private readonly createFormData: () => FormData;

  constructor(
    client: ExpenseHttpClient,
    createFormData: () => FormData = () => new FormData(),
  ) {
    this.client = client;
    this.createFormData = createFormData;
  }

  async createExpense(payload: CreateExpensePayload): Promise<ExpenseRecord> {
    const response = await this.client.post<ApiResponse<ExpenseRecord>>('/api/Expense', payload);
    return response.data;
  }

  async getExpense(id: number): Promise<EditableExpenseRecord> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid expense ID.');
    if (!this.client.get) throw new Error('Expense details are unavailable.');
    const response = await this.client.get<ApiResponse<EditableExpenseRecord>>(`/api/Expense/${id}`);
    if (!response.success || !response.data || response.data.id !== id) throw new Error('Expense detail could not be loaded.');
    return response.data;
  }

  async updateExpense(id: number, payload: { id: number; [key: string]: unknown }): Promise<ExpenseRecord> {
    if (!Number.isSafeInteger(id) || id <= 0 || payload.id !== id) throw new Error('Expense ID mismatch.');
    if (!this.client.put) throw new Error('Expense update is unavailable.');
    const response = await this.client.put<ApiResponse<ExpenseRecord>>(`/api/Expense/${id}`, payload);
    if (!response.success || !response.data) throw new Error('Expense update failed.');
    return response.data;
  }

  async uploadReceipt(expenseId: number, receipt: LocalExpenseReceipt): Promise<void> {
    const form = this.createFormData();
    form.append('files', { uri: receipt.uri, name: receipt.fileName, type: receipt.mimeType } as any);
    await this.client.post(`/api/ExpenseReceipt/${expenseId}`, form, { headers: { 'Content-Type': undefined } });
  }
}
