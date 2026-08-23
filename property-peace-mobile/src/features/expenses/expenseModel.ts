import { categorizeExpense } from '@property-peace/shared/expense-categorization';

export type ExpenseStep = 'details' | 'description' | 'review';

export interface ExpenseFormState {
  amount: string;
  expenseDate: string;
  propertyId: number | null;
  unitId: number | null;
  description: string;
}

export interface LocalExpenseReceipt {
  uri: string;
  fileName: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileSize?: number;
}

export interface CreateExpensePayload {
  landlordId: number;
  propertyId: number;
  unitId: number | null;
  name: string;
  category: string;
  amount: number;
  expenseDate: string;
  isRecurring: false;
  isPaid: true;
  paidDate: string;
  billDate: string;
  dueDate: string;
}

export const EXPENSE_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

const amountPattern = /^\d+(\.\d{1,2})?$/;
const taxCategoryLabels: Record<number, string> = {
  0: 'None', 1: 'Repairs', 2: 'Maintenance', 3: 'Cleaning', 4: 'Landscaping', 5: 'Utilities',
  6: 'Water', 7: 'Sewer', 8: 'Garbage', 9: 'Internet', 10: 'Phone', 11: 'Insurance',
  12: 'Liability insurance', 13: 'Property insurance', 14: 'Property taxes', 15: 'Local taxes',
  16: 'State taxes', 17: 'Property management', 18: 'Legal fees', 19: 'Accounting fees',
  20: 'Professional services', 21: 'Advertising', 22: 'Marketing', 23: 'Travel', 24: 'Transportation',
  25: 'Vehicle expenses', 26: 'Depreciation', 27: 'Improvements', 28: 'Other', 29: 'Supplies',
  30: 'Office expenses', 31: 'Bank fees', 32: 'Interest', 33: 'Mortgage interest',
  34: 'Contract labor', 35: 'Services',
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isValidLocalDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const parseAmount = (value: string) => {
  if (!amountPattern.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

export const emptyExpenseForm = (date = new Date()): ExpenseFormState => ({
  amount: '', expenseDate: formatLocalDate(date), propertyId: null, unitId: null, description: '',
});

export const setExpenseProperty = (form: ExpenseFormState, propertyId: number | null): ExpenseFormState => ({
  ...form, propertyId, unitId: null,
});

export const validateExpenseStep = (form: ExpenseFormState, step: ExpenseStep): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (step === 'details' || step === 'review') {
    if (parseAmount(form.amount) === null) errors.amount = 'Enter an amount greater than zero.';
    if (!isValidLocalDate(form.expenseDate)) errors.expenseDate = 'Enter a valid date.';
    if (!Number.isInteger(form.propertyId) || form.propertyId <= 0) errors.propertyId = 'Choose a property.';
  }
  if (step === 'description' || step === 'review') {
    const description = form.description.trim();
    if (!description) errors.description = 'Describe the expense.';
    else if (description.length > 200) errors.description = 'Keep the description to 200 characters or fewer.';
  }
  return errors;
};

export const normalizeSupportedImageMime = (mimeType?: string, fileName = ''): LocalExpenseReceipt['mimeType'] | null => {
  const normalizedMime = mimeType?.trim().toLowerCase();
  if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/png' || normalizedMime === 'image/webp') return normalizedMime;
  const normalizedFileName = fileName.trim().toLowerCase();
  if (normalizedFileName.endsWith('.jpg') || normalizedFileName.endsWith('.jpeg')) return 'image/jpeg';
  if (normalizedFileName.endsWith('.png')) return 'image/png';
  if (normalizedFileName.endsWith('.webp')) return 'image/webp';
  return null;
};

export const validateExpenseReceipt = (receipt: { uri: string; fileName: string; mimeType?: string; fileSize?: number }): string | null => {
  if (!normalizeSupportedImageMime(receipt.mimeType, receipt.fileName)) return 'Use a JPEG, PNG, or WebP image.';
  if (receipt.fileSize !== undefined && receipt.fileSize > EXPENSE_RECEIPT_MAX_BYTES) return 'Receipt images must be 10 MB or smaller.';
  return null;
};

export const buildCreateExpensePayload = (form: ExpenseFormState, landlordId: number | null | undefined, paidDate: string): CreateExpensePayload => {
  if (!Number.isInteger(landlordId) || landlordId <= 0) throw new Error('A landlord ID is required.');
  if (Object.keys(validateExpenseStep(form, 'review')).length > 0) throw new Error('Expense form is invalid.');
  const amount = parseAmount(form.amount);
  if (amount === null || !Number.isInteger(form.propertyId) || form.propertyId <= 0) throw new Error('Expense form is invalid.');
  return {
    landlordId, propertyId: form.propertyId, unitId: form.unitId, name: form.description.trim(),
    category: categorizeExpense(form.description).category, amount, expenseDate: form.expenseDate,
    isRecurring: false, isPaid: true, paidDate, billDate: form.expenseDate, dueDate: form.expenseDate,
  };
};

export const getTaxCategoryPresentation = (taxCategory: number | null | undefined) => {
  const label = taxCategory === null || taxCategory === undefined || taxCategory === 0 ? undefined : taxCategoryLabels[taxCategory];
  return label ? { status: 'categorized' as const, label } : { status: 'needs-review' as const, label: 'Needs category review' };
};
