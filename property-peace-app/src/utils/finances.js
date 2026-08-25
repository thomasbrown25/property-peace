import { buildMoneyCenterQuery } from './moneyCenter.js';

export const FINANCES_TABS = ['review', 'activity', 'expenses', 'payments', 'upcoming'];
export const FINANCES_PERIODS = ['this-month', 'last-month', 'ytd', 'last-year', 'custom'];

export function normalizeFinancesTab(value) {
  return FINANCES_TABS.includes(value) ? value : 'activity';
}

export function updateFinancesSearch(current, changes = {}) {
  const next = new URLSearchParams(current);
  Object.entries(changes).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') next.delete(key);
    else next.set(key, String(value));
  });
  next.set('tab', normalizeFinancesTab(next.get('tab')));
  return next;
}

export function selectFinancesExportState(registration, activeTab, registrationKey) {
  if (!registration || registration.tab !== activeTab || registration.registrationKey !== registrationKey) return null;
  return registration.exportState || null;
}

export function isFinancesPageLoading({
  propertiesLoading = false,
  moneyLoading = false,
  moneyScopeChanged = false,
  paymentsLoading = false,
  paymentsScopeChanged = false,
  expensesLoading = false
} = {}) {
  return Boolean(
    propertiesLoading ||
    moneyLoading ||
    moneyScopeChanged ||
    paymentsLoading ||
    paymentsScopeChanged ||
    expensesLoading
  );
}
export function normalizeFinancesPeriod(value) {
  return FINANCES_PERIODS.includes(value) ? value : 'ytd';
}

const propertyIdentity = (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export function updateFinancesPropertyScope(current, propertyId) {
  const currentPropertyId = propertyIdentity(new URLSearchParams(current).get('propertyId'));
  const nextPropertyId = propertyIdentity(propertyId);
  return updateFinancesSearch(current, {
    propertyId: nextPropertyId,
    ...(currentPropertyId === nextPropertyId ? {} : { unitId: undefined })
  });
}

export function buildFinancesMoneyQuery(search, now = new Date()) {
  const scoped = new URLSearchParams(search);
  scoped.set('period', normalizeFinancesPeriod(scoped.get('period')));
  return buildMoneyCenterQuery(scoped, now);
}

const list = (value) => Array.isArray(value) ? value : [];
const amountOf = (item) => {
  const value = Number(item?.amount ?? item?.Amount ?? 0);
  return Number.isFinite(value) ? value : 0;
};
const dateValue = (value) => {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : null;
};

export function buildActivityEntries(items) {
  const posted = list(items).filter((item) => item?.direction === 'cameIn' || item?.direction === 'wentOut');
  const oldest = posted.filter((item) => dateValue(item.occurredAt) !== null).sort((a, b) => {
    const at = dateValue(a.occurredAt), bt = dateValue(b.occurredAt);
    if (at === null && bt === null) return String(a.sourceId ?? '').localeCompare(String(b.sourceId ?? ''));
    if (at === null) return 1;
    if (bt === null) return -1;
    return at - bt || String(a.sourceId ?? '').localeCompare(String(b.sourceId ?? ''));
  });
  let balance = 0;
  const entries = oldest.map((item) => {
    const amount = amountOf(item);
    const signedAmount = amount === 0 ? 0 : (item.direction === 'cameIn' ? amount : -amount);
    balance += signedAmount;
    const timestamp = dateValue(item.occurredAt);
    return {
      id: item.sourceId, sourceId: item.sourceId, sourceType: item.sourceType,
      occurredAt: item.occurredAt, timestamp, direction: item.direction, signedAmount,
      amount, description: item.description || item.category || 'Financial activity',
      account: item.category || 'Uncategorized', propertyId: item.propertyId,
      propertyName: item.propertyName || 'Property not recorded', unitId: item.unitId ?? null,
      unitName: item.unitName || 'Property level', counterparty: item.counterparty || '',
      method: item.method || '', reference: item.reference || '', treatment: item.treatment || '',
      runningBalance: balance
    };
  });
  const invalidEntries = posted.filter((item) => dateValue(item.occurredAt) === null).map((item) => {
    const amount = amountOf(item);
    return { id: item.sourceId, sourceId: item.sourceId, sourceType: item.sourceType, occurredAt: item.occurredAt, timestamp: null, direction: item.direction, signedAmount: amount === 0 ? 0 : (item.direction === 'cameIn' ? amount : -amount), amount, description: item.description || item.category || 'Financial activity', account: item.category || 'Uncategorized', propertyId: item.propertyId, propertyName: item.propertyName || 'Property not recorded', unitId: item.unitId ?? null, unitName: item.unitName || 'Property level', counterparty: item.counterparty || '', method: item.method || '', reference: item.reference || '', treatment: item.treatment || '', runningBalance: balance };
  }).sort((a, b) => String(a.sourceId ?? '').localeCompare(String(b.sourceId ?? '')));
  return entries.reverse().concat(invalidEntries);
}

export function selectNeedsReviewItems(items) {
  const byId = new Map();
  list(items).forEach((item) => {
    const reasons = [];
    if (item?.sourceType === 'expense' && item.direction === 'wentOut' && item.category?.trim().toLowerCase() === 'uncategorized') reasons.push('Uncategorized');
    if (item?.sourceType === 'expense' && item.direction === 'wentOut' && !item.hasReceipt) reasons.push('Missing receipt');
    if (item?.direction === 'obligation' && item.needsAttention) reasons.push('Overdue obligation');
    if (item?.sourceType === 'payment' && item.needsAttention) reasons.push('Settlement exception');
    if (!reasons.length) return;
    const key = item.sourceId;
    const prior = byId.get(key);
    if (prior) prior.reviewReasons = [...new Set([...prior.reviewReasons, ...reasons])];
    else byId.set(key, { ...item, reviewReasons: reasons });
  });
  return [...byId.values()];
}

const activityType = (entry) => entry?.direction === 'cameIn' ? 'income' : entry?.direction === 'wentOut' ? 'expense' : '';
const activitySearchText = (entry) => [
  entry?.sourceId, entry?.description, entry?.account, entry?.propertyName, entry?.unitName,
  entry?.counterparty, entry?.reference, entry?.sourceType
].filter(Boolean).join(' ').toLocaleLowerCase();
const propertyUnitLabel = (item) => `${item?.propertyName || 'Property not recorded'} / ${item?.unitName || 'Property level'}`;

export function getActivityAccountOptions(entries) {
  const unique = new Map();
  list(entries).forEach((entry) => {
    const account = typeof entry?.account === 'string' ? entry.account.trim() : '';
    const key = account.toLocaleLowerCase();
    if (account && !unique.has(key)) unique.set(key, account);
  });
  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}

export function selectActivityEntriesPage(entries, filters = {}) {
  const search = String(filters.search || '').trim().toLocaleLowerCase();
  const type = ['income', 'expense'].includes(filters.type) ? filters.type : 'all';
  const account = String(filters.account || 'all').trim().toLocaleLowerCase();
  const sort = filters.sort || 'newest';
  const pageSize = Number.isSafeInteger(filters.pageSize) && filters.pageSize > 0 ? filters.pageSize : 12;
  const filteredEntries = list(entries).filter((entry) => {
    if (search && !activitySearchText(entry).includes(search)) return false;
    if (type !== 'all' && activityType(entry) !== type) return false;
    if (account !== 'all' && String(entry?.account || '').trim().toLocaleLowerCase() !== account) return false;
    return true;
  }).sort((a, b) => {
    const bySource = String(a?.sourceId ?? '').localeCompare(String(b?.sourceId ?? ''));
    if (sort === 'oldest') return (a?.timestamp ?? Number.POSITIVE_INFINITY) - (b?.timestamp ?? Number.POSITIVE_INFINITY) || bySource;
    if (sort === 'amount-desc') return Math.abs(Number(b?.signedAmount) || 0) - Math.abs(Number(a?.signedAmount) || 0) || bySource;
    if (sort === 'amount-asc') return Math.abs(Number(a?.signedAmount) || 0) - Math.abs(Number(b?.signedAmount) || 0) || bySource;
    if (sort === 'balance-desc') return (Number(b?.runningBalance) || 0) - (Number(a?.runningBalance) || 0) || bySource;
    return (b?.timestamp ?? Number.NEGATIVE_INFINITY) - (a?.timestamp ?? Number.NEGATIVE_INFINITY) || bySource;
  });
  const totalCount = filteredEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const requestedPage = Number.isSafeInteger(filters.page) ? filters.page : Number(filters.page);
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1));
  return {
    filteredEntries,
    visibleEntries: filteredEntries.slice((page - 1) * pageSize, page * pageSize),
    totalCount,
    totalPages,
    page
  };
}

export function buildActivityCsvRows(entries) {
  return list(entries).map((entry) => ({
    'Source ID': entry?.sourceId || '',
    Date: entry?.occurredAt || '',
    Type: activityType(entry) === 'income' ? 'Income' : 'Expense',
    Description: entry?.description || '',
    'Property / unit': propertyUnitLabel(entry),
    Account: entry?.account || 'Uncategorized',
    Amount: Number(entry?.signedAmount) || 0,
    'Activity balance': Number(entry?.runningBalance) || 0,
    'Source type': entry?.sourceType || ''
  }));
}

export function buildReviewCsvRows(items) {
  return list(items).map((item) => ({
    'Source ID': item?.sourceId || '',
    Date: item?.occurredAt || '',
    Reasons: list(item?.reviewReasons).join('; '),
    Description: item?.description || item?.category || '',
    'Property / unit': propertyUnitLabel(item),
    Category: item?.category || 'Uncategorized',
    Amount: amountOf(item),
    'Source type': item?.sourceType || ''
  }));
}
export function buildAccountActivity(entries, limit) {
  const grouped = new Map();
  list(entries).forEach((entry) => {
    const account = entry.account || 'Uncategorized';
    const current = grouped.get(account) || { account, signedTotal: 0, count: 0 };
    current.signedTotal += Number.isFinite(Number(entry.signedAmount)) ? Number(entry.signedAmount) : 0;
    current.count += 1;
    grouped.set(account, current);
  });
  const result = [...grouped.values()].sort((a, b) => Math.abs(b.signedTotal) - Math.abs(a.signedTotal) || a.account.localeCompare(b.account));
  return limit === undefined ? result : result.slice(0, limit);
}

export function buildUpcomingEntries(recurring, future) {
  const normalize = (item, type, actionDate) => {
    const id = item.id ?? item.sourceId;
    return {
      key: `${type}:${id}`, id, type, name: item.name || item.description || '',
      category: item.category || 'Uncategorized', propertyName: item.propertyName || 'Property not recorded',
      unitName: item.unitName || 'Property level', amount: amountOf(item), actionDate,
      frequency: item.frequency || '', isPaused: Boolean(item.isPaused), source: item
    };
  };
  const entries = [
    ...list(recurring).map((item) => normalize(item, 'Recurring', item.nextOccurrenceDate)),
    ...list(future).map((item) => normalize(item, 'One-time', item.dueDate))
  ];
  return entries.sort((a, b) => {
    const ad = dateValue(a.actionDate), bd = dateValue(b.actionDate);
    if (ad === null && bd === null) return 0;
    if (ad === null) return 1;
    if (bd === null) return -1;
    return ad - bd;
  });
}
export function sumCollectedThisMonth(payments, now = new Date(), propertyId) {
  const year = now.getUTCFullYear(), month = now.getUTCMonth();
  return list(payments).reduce((total, payment) => {
    const status = String(payment.status ?? payment.Status ?? '').toLowerCase();
    if (!['completed', 'succeeded', 'paid'].includes(status)) return total;
    const selectedProperty = payment.propertyId ?? payment.PropertyId;
    if (propertyId !== undefined && Number(selectedProperty) !== Number(propertyId)) return total;
    const paidAt = payment.paidAt ?? payment.PaidAt ?? payment.paymentDate ?? payment.PaymentDate ?? payment.createdAt;
    const date = dateValue(paidAt);
    if (date === null) return total;
    const when = new Date(date);
    if (when.getUTCFullYear() !== year || when.getUTCMonth() !== month) return total;
    return total + amountOf(payment);
  }, 0);
}
