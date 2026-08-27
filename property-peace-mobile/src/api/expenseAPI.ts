import type { AxiosRequestConfig } from 'axios';
import type { ApiResponse } from '../types';
import type { CreateExpensePayload, LocalExpenseReceipt, TaxCategoryWireValue } from '../features/expenses/expenseModel';

export interface ExpenseRecord {
  id: number;
  name: string;
  amount: number;
  taxCategory: TaxCategoryWireValue | null;
}

export interface ExpenseHttpClient {
  post<T>(url: string, data?: unknown, options?: AxiosRequestConfig): Promise<T>;
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

  async uploadReceipt(expenseId: number, receipt: LocalExpenseReceipt): Promise<void> {
    const form = this.createFormData();
    form.append('files', { uri: receipt.uri, name: receipt.fileName, type: receipt.mimeType } as any);
    await this.client.post(`/api/ExpenseReceipt/${expenseId}`, form, { headers: { 'Content-Type': undefined } });
  }
}
