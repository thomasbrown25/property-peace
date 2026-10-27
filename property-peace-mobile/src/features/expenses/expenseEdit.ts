// Node's strip-types test runner requires the extension; Metro resolves this same source file.
// @ts-ignore TS5097: test runner imports TypeScript directly without a bundler
import { validateExpenseStep, type ExpenseFormState } from './expenseModel.ts';

// PUT /api/Expense/{id} replaces the aggregate, including payment, recurrence and tax
// fields. Always load the full record first; a money-center summary is NOT sufficient.
export interface EditableExpenseRecord {
  id: number; propertyId: number; unitId?: number | null; name: string; category: string;
  amount: number; expenseDate: string; vendor?: string | null; paymentMethod?: string | null;
  vendorId?: number | null; receiptUrl?: string | null; isRecurring: boolean;
  frequency?: number | string | null; dayOfPeriod?: number | null;
  startDate?: string | null; endDate?: string | null; isPaused?: boolean;
  isTaxDeductible?: boolean; taxCategory?: number | string | null;
  isLoanPayment?: boolean; loanPrincipalAmount?: number | null;
  loanInterestAmount?: number | null; loanProvider?: string | null;
  maintenanceRequestId?: number | null; billDate?: string | null;
  dueDate?: string | null; isPaid: boolean; paidDate?: string | null;
  billNumber?: string | null;
}

const validId = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const assertComplete = (expense: EditableExpenseRecord) => {
  if (!expense || !validId(expense.id) || !validId(expense.propertyId) ||
      typeof expense.name !== 'string' || typeof expense.category !== 'string' ||
      !Number.isFinite(expense.amount) || !/^\d{4}-\d{2}-\d{2}/.test(expense.expenseDate) ||
      typeof expense.isPaid !== 'boolean' || typeof expense.isRecurring !== 'boolean') {
    throw new Error('A valid existing expense detail is required before editing.');
  }
};

export function expenseEditForm(expense: EditableExpenseRecord): ExpenseFormState {
  assertComplete(expense);
  return {
    amount: String(expense.amount), expenseDate: expense.expenseDate.slice(0, 10),
    propertyId: expense.propertyId, unitId: expense.unitId ?? null,
    description: expense.name, category: expense.category,
    vendor: expense.vendor ?? '', paymentMethod: expense.paymentMethod ?? '',
  };
}

export function buildExpenseUpdate(form: ExpenseFormState, expense: EditableExpenseRecord) {
  assertComplete(expense);
  if (Object.keys(validateExpenseStep(form, 'review')).length) throw new Error('Expense form is invalid.');
  // Never spread the server response: it contains read-only fields and signed receipt URLs.
  return {
    id: expense.id, propertyId: form.propertyId!, unitId: form.unitId,
    name: form.description.trim(), category: form.category?.trim() || expense.category,
    amount: Number(form.amount), expenseDate: form.expenseDate,
    vendor: form.vendor?.trim() || null, vendorId: expense.vendorId ?? null,
    paymentMethod: form.paymentMethod?.trim() || null, receiptUrl: expense.receiptUrl ?? null,
    isRecurring: expense.isRecurring, frequency: expense.frequency ?? null,
    dayOfPeriod: expense.dayOfPeriod ?? null, startDate: expense.startDate ?? null,
    endDate: expense.endDate ?? null, isPaused: expense.isPaused ?? false,
    isTaxDeductible: expense.isTaxDeductible ?? false, taxCategory: expense.taxCategory ?? null,
    isLoanPayment: expense.isLoanPayment ?? false,
    loanPrincipalAmount: expense.loanPrincipalAmount ?? null,
    loanInterestAmount: expense.loanInterestAmount ?? null, loanProvider: expense.loanProvider ?? null,
    maintenanceRequestId: expense.maintenanceRequestId ?? null,
    billDate: expense.billDate ?? null, dueDate: expense.dueDate ?? null,
    isPaid: expense.isPaid, paidDate: expense.paidDate ?? null,
    billNumber: expense.billNumber ?? null,
  };
}
