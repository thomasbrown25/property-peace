import type { ExpenseRecord } from '../../api/expenseAPI';
import type { CreateExpensePayload, LocalExpenseReceipt } from './expenseModel';

export interface ExpenseSubmissionApi {
  createExpense(payload: CreateExpensePayload): Promise<ExpenseRecord>;
  uploadReceipt(expenseId: number, receipt: LocalExpenseReceipt): Promise<void>;
}

export type ExpenseSubmissionResult =
  | { status: 'saved'; expense: ExpenseRecord }
  | { status: 'receipt-failed'; expense: ExpenseRecord; receipt: LocalExpenseReceipt; message: string };

export function getExpenseErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const candidate = (error as { message?: unknown; Message?: unknown }).message
      ?? (error as { Message?: unknown }).Message;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

export async function submitExpense(
  payload: CreateExpensePayload,
  receipt: LocalExpenseReceipt | null,
  api: ExpenseSubmissionApi,
): Promise<ExpenseSubmissionResult> {
  const expense = await api.createExpense(payload);
  if (!receipt) return { status: 'saved', expense };

  try {
    await api.uploadReceipt(expense.id, receipt);
    return { status: 'saved', expense };
  } catch (error) {
    return {
      status: 'receipt-failed',
      expense,
      receipt,
      message: getExpenseErrorMessage(error, 'Receipt upload failed.'),
    };
  }
}

export async function retryExpenseReceipt(
  expenseId: number,
  receipt: LocalExpenseReceipt,
  api: Pick<ExpenseSubmissionApi, 'uploadReceipt'>,
): Promise<void> {
  await api.uploadReceipt(expenseId, receipt);
}
