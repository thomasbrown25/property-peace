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
export type TaxCategoryWireValue = string;

const taxCategoryLabels: Record<TaxCategoryWireValue, string> = {
  none: 'None', repairs: 'Repairs', maintenance: 'Maintenance', cleaning: 'Cleaning', landscaping: 'Landscaping',
  utilities: 'Utilities', water: 'Water', sewer: 'Sewer', garbage: 'Garbage', internet: 'Internet', phone: 'Phone',
  insurance: 'Insurance', liabilityInsurance: 'Liability insurance', propertyInsurance: 'Property insurance',
  propertyTaxes: 'Property taxes', localTaxes: 'Local taxes', stateTaxes: 'State taxes',
  propertyManagement: 'Property management', legalFees: 'Legal fees', accountingFees: 'Accounting fees', professionalServices: 'Professional services',
  advertising: 'Advertising', marketing: 'Marketing', travel: 'Travel', transportation: 'Transportation', vehicleExpenses: 'Vehicle expenses',
  depreciation: 'Depreciation', improvements: 'Improvements', other: 'Other', supplies: 'Supplies', officeExpenses: 'Office expenses',
  bankFees: 'Bank fees', interest: 'Interest', mortgageInterest: 'Mortgage interest', contractLabor: 'Contract labor', services: 'Services',
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
    if (typeof form.propertyId !== 'number' || !Number.isInteger(form.propertyId) || form.propertyId <= 0) errors.propertyId = 'Choose a property.';
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
  if (typeof landlordId !== 'number' || !Number.isInteger(landlordId) || landlordId <= 0) throw new Error('A landlord ID is required.');
  if (Object.keys(validateExpenseStep(form, 'review')).length > 0) throw new Error('Expense form is invalid.');
  const amount = parseAmount(form.amount);
  const propertyId = form.propertyId;
  if (amount === null || typeof propertyId !== 'number' || !Number.isInteger(propertyId) || propertyId <= 0) throw new Error('Expense form is invalid.');
  return {
    landlordId, propertyId, unitId: form.unitId, name: form.description.trim(),
    category: categorizeExpense(form.description).category, amount, expenseDate: form.expenseDate,
    isRecurring: false, isPaid: true, paidDate, billDate: form.expenseDate, dueDate: form.expenseDate,
  };
};

export const getTaxCategoryPresentation = (taxCategory: TaxCategoryWireValue | null | undefined) => {
  const label = taxCategory === null || taxCategory === undefined || taxCategory === 'none' ? undefined : taxCategoryLabels[taxCategory];
  return label ? { status: 'categorized' as const, label } : { status: 'needs-review' as const, label: 'Needs category review' };
};
