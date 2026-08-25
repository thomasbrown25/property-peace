const list = (value) => Array.isArray(value) ? value : [];
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});

export const readExpense = (expense, camel, pascal) => expense?.[camel] ?? expense?.[pascal];
export const getExpenseId = (expense) => readExpense(expense, 'id', 'Id');
export const getExpenseAmount = (expense) => {
  const amount = Number(readExpense(expense, 'amount', 'Amount') ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};
export const isExpensePaid = (expense) => Boolean(readExpense(expense, 'isPaid', 'IsPaid'));
export const isExpenseTaxDeductible = (expense) => Boolean(readExpense(expense, 'isTaxDeductible', 'IsTaxDeductible'));
export const hasExpenseReceipt = (expense) => {
  const receipts = readExpense(expense, 'receipts', 'Receipts');
  return (Array.isArray(receipts) && receipts.length > 0) || Boolean(readExpense(expense, 'receiptUrl', 'ReceiptUrl'));
};

export function formatExpenseDate(value) {
  if (value === undefined || value === null || value === '') return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Not set' : dateFormatter.format(date);
}

const isoDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
};

export function buildExpenseHookFilters({ propertyId, sharedFrom, sharedTo, mutationVersion } = {}) {
  const exclusiveEnd = new Date(sharedTo || '');
  const inclusiveEnd = Number.isNaN(exclusiveEnd.valueOf())
    ? null
    : new Date(exclusiveEnd.valueOf() - 1).toISOString().slice(0, 10);
  return {
    propertyId: propertyId || null,
    startDate: isoDate(sharedFrom),
    endDate: inclusiveEnd,
    mutationVersion
  };
}

const searchText = (expense) => [
  readExpense(expense, 'name', 'Name'),
  readExpense(expense, 'category', 'Category'),
  readExpense(expense, 'propertyName', 'PropertyName'),
  readExpense(expense, 'unitName', 'UnitName'),
  readExpense(expense, 'vendor', 'Vendor')
].filter(Boolean).join(' ').toLocaleLowerCase();

const expenseTimestamp = (expense) => {
  const value = readExpense(expense, 'expenseDate', 'ExpenseDate');
  const timestamp = Date.parse(value || '');
  return Number.isNaN(timestamp) ? null : timestamp;
};

const isInSharedScope = (expense, { propertyId, from, to }) => {
  if (propertyId && Number(readExpense(expense, 'propertyId', 'PropertyId')) !== Number(propertyId)) return false;
  const fromTimestamp = Date.parse(from || '');
  const toTimestamp = Date.parse(to || '');
  if (Number.isNaN(fromTimestamp) && Number.isNaN(toTimestamp)) return true;
  const timestamp = expenseTimestamp(expense);
  if (timestamp === null) return false;
  if (!Number.isNaN(fromTimestamp) && timestamp < fromTimestamp) return false;
  if (!Number.isNaN(toTimestamp) && timestamp >= toTimestamp) return false;
  return true;
};

const matchesStatus = (expense, status) => {
  if (status === 'paid') return isExpensePaid(expense);
  if (status === 'unpaid') return !isExpensePaid(expense);
  if (status === 'tax') return isExpenseTaxDeductible(expense);
  if (status === 'missing-receipt') return !hasExpenseReceipt(expense);
  return true;
};

export function selectExpensesPage(expenses, filters = {}) {
  const query = String(filters.search || '').trim().toLocaleLowerCase();
  const category = filters.category || 'all';
  const status = filters.status || 'all';
  const sort = filters.sort || 'newest';
  const pageSize = Number.isSafeInteger(filters.pageSize) && filters.pageSize > 0 ? filters.pageSize : 10;
  const scopedExpenses = list(expenses).filter((expense) => isInSharedScope(expense, filters));
  const filteredExpenses = scopedExpenses
    .filter((expense) => !query || searchText(expense).includes(query))
    .filter((expense) => category === 'all' || readExpense(expense, 'category', 'Category') === category)
    .filter((expense) => matchesStatus(expense, status))
    .sort((a, b) => {
      if (sort === 'amount-high') return getExpenseAmount(b) - getExpenseAmount(a);
      if (sort === 'amount-low') return getExpenseAmount(a) - getExpenseAmount(b);
      if (sort === 'category') {
        return String(readExpense(a, 'category', 'Category') || '').localeCompare(String(readExpense(b, 'category', 'Category') || ''));
      }
      const aDate = expenseTimestamp(a) ?? 0;
      const bDate = expenseTimestamp(b) ?? 0;
      return sort === 'oldest' ? aDate - bDate : bDate - aDate;
    });
  const totalCount = filteredExpenses.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const requestedPage = Number(filters.page);
  const page = Math.min(totalPages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const visibleExpenses = filteredExpenses.slice((page - 1) * pageSize, page * pageSize);
  return {
    unfilteredCount: scopedExpenses.length,
    totalCount,
    totalPages,
    page,
    visibleExpenses
  };
}

export function buildExpenseCsvRows(expenses) {
  return list(expenses).map((expense) => ({
    Date: formatExpenseDate(readExpense(expense, 'expenseDate', 'ExpenseDate')),
    Name: readExpense(expense, 'name', 'Name') || '',
    Category: readExpense(expense, 'category', 'Category') || '',
    Property: readExpense(expense, 'propertyName', 'PropertyName') || '',
    Unit: readExpense(expense, 'unitName', 'UnitName') || '',
    Vendor: readExpense(expense, 'vendor', 'Vendor') || '',
    Status: isExpensePaid(expense) ? 'Paid' : 'Unpaid',
    TaxDeductible: isExpenseTaxDeductible(expense) ? 'Yes' : 'No',
    Amount: getExpenseAmount(expense)
  }));
}

export function maskExpenseMetricsAvailability(overview, expensesAvailable) {
  if (!overview || expensesAvailable) return overview;
  return {
    ...overview,
    fieldAvailability: {
      ...overview.fieldAvailability,
      wentOut: false,
      recordedNetCashFlow: false
    }
  };
}
