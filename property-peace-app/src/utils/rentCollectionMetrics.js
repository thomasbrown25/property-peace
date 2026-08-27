const finiteNonNegative = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const FINALIZED_RENT_STATUSES = new Set(['completed', 'paid']);

const readDate = (item, ...keys) => keys.map((key) => item?.[key]).find(Boolean);
const readAmount = (item) => finiteNonNegative(item?.amount ?? item?.Amount);

const toLocalDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value || '');
  if (Number.isNaN(date.valueOf())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isFinalizedRentPayment = (payment) => {
  const status = String(payment?.status ?? payment?.Status ?? '').trim().toLowerCase();
  const feeId = payment?.feeId ?? payment?.FeeId;
  const depositId = payment?.depositId ?? payment?.DepositId;
  return FINALIZED_RENT_STATUSES.has(status) && feeId == null && depositId == null;
};

/**
 * Normalizes the dashboard's monthly rent metrics. The API attributes finalized
 * rent credits to the oldest unpaid period first, so collectedThisMonth—not the
 * transaction date or overdue classification—drives current-period progress.
 */
export const normalizeRentCollectionMetrics = (summary = {}) => {
  const expectedRent = finiteNonNegative(summary?.expectedThisMonth ?? summary?.ExpectedThisMonth);
  const income = finiteNonNegative(summary?.collectedThisMonth ?? summary?.CollectedThisMonth);
  const collectedAgainstExpected = Math.min(expectedRent, income);
  const remainingRent = Math.max(0, expectedRent - collectedAgainstExpected);
  const collectionPct = expectedRent > 0 ? Math.min(100, (collectedAgainstExpected / expectedRent) * 100) : 0;

  return { expectedRent, income, remainingRent, collectionPct };
};

export const buildCurrentMonthMoneySeries = ({ payments = [], expenses = [], now = new Date() } = {}) => {
  const today = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(today.valueOf())) return [];

  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const daily = [];
  const byDate = new Map();

  for (let cursor = new Date(firstDay); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const date = new Date(cursor);
    const key = toLocalDateKey(date);
    const point = {
      label: date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
      income: 0,
      expenses: 0
    };
    daily.push(point);
    byDate.set(key, point);
  }

  payments.filter(isFinalizedRentPayment).forEach((payment) => {
    const key = toLocalDateKey(readDate(payment, 'paymentDate', 'PaymentDate', 'createdAt', 'CreatedAt'));
    if (byDate.has(key)) byDate.get(key).income += readAmount(payment);
  });

  expenses.forEach((expense) => {
    const key = toLocalDateKey(readDate(expense, 'paidDate', 'PaidDate', 'expenseDate', 'ExpenseDate'));
    if (byDate.has(key)) byDate.get(key).expenses += readAmount(expense);
  });

  return daily;
};

export const summarizeCurrentMonthRentIncome = (payments = [], now = new Date()) =>
  buildCurrentMonthMoneySeries({ payments, now }).reduce((sum, point) => sum + point.income, 0);
