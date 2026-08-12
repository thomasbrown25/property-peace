const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (year, month, day = 1) => new Date(Date.UTC(year, month, day)).toISOString();
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
});

export function formatMoneyCenterDate(value) {
  if (value === undefined || value === null || value === '') return 'Date unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? 'Date unavailable' : dateFormatter.format(parsed);
}

export function getPeriodRange(period = 'this-month', now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (period === 'last-month') return { from: iso(year, month - 1), to: iso(year, month) };
  if (period === 'ytd') {
    const from = iso(year, 0);
    return { from, to: new Date(Math.max(now.valueOf(), new Date(from).valueOf() + 1)).toISOString() };
  }
  if (period === 'last-year') return { from: iso(year - 1, 0), to: iso(year, 0) };
  const from = iso(year, month);
  return { from, to: new Date(Math.max(now.valueOf(), new Date(from).valueOf() + 1)).toISOString() };
}

const positiveId = (value) => {
  if (!/^\d+$/.test(value || '')) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export function buildMoneyCenterQuery(search, now = new Date()) {
  const requestedPeriod = search.get('period') || 'this-month';
  let range = getPeriodRange(requestedPeriod, now);
  if (requestedPeriod === 'custom') {
    const from = search.get('from');
    const through = search.get('to');
    if (ISO_DATE.test(from || '') && ISO_DATE.test(through || '')) {
      const start = new Date(`${from}T00:00:00.000Z`);
      const end = new Date(`${through}T00:00:00.000Z`);
      if (!Number.isNaN(start.valueOf()) && !Number.isNaN(end.valueOf()) && start <= end) {
        end.setUTCDate(end.getUTCDate() + 1);
        range = { from: start.toISOString(), to: end.toISOString() };
      }
    }
  }
  const propertyId = positiveId(search.get('propertyId'));
  const unitId = positiveId(search.get('unitId'));
  return { ...range, ...(propertyId ? { propertyId } : {}), ...(unitId ? { unitId } : {}), upcomingDays: 30 };
}

export function moneyCenterScopeToSearch(current, changes) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === null || value === '') next.delete(key);
    else next.set(key, String(value));
  }
  if (Object.hasOwn(changes, 'propertyId') && !Object.hasOwn(changes, 'unitId')) next.delete('unitId');
  return next;
}

const list = (value) => Array.isArray(value) ? value : [];
const count = (value) => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : 0;
const hasNumber = (value) => value !== null && value !== '' && Number.isFinite(Number(value));

const normalizeAmountCount = (value, fallbackAmount) => ({
  ...(value && typeof value === 'object' ? value : {}),
  amount: count(value?.amount ?? fallbackAmount),
  count: count(value?.count)
});

const cashFlowAvailability = (value) => ({
  cameIn: hasNumber(value?.cameIn),
  wentOut: hasNumber(value?.wentOut),
  recordedNetCashFlow: hasNumber(value?.recordedNetCashFlow)
});

const normalizeProperties = (value) => list(value).filter((property) => property && typeof property === 'object').map((property) => ({
  ...property,
  cameIn: count(property.cameIn),
  wentOut: count(property.wentOut),
  recordedNetCashFlow: count(property.recordedNetCashFlow),
  fieldAvailability: cashFlowAvailability(property),
  unitsAvailable: Array.isArray(property.units),
  units: list(property.units).filter((unit) => unit && typeof unit === 'object').map((unit) => ({
    ...unit,
    cameIn: count(unit.cameIn),
    wentOut: count(unit.wentOut),
    recordedNetCashFlow: count(unit.recordedNetCashFlow),
    fieldAvailability: cashFlowAvailability(unit)
  }))
}));

const normalizeCategories = (value) => list(value).filter((category) => category && typeof category === 'object').map((category) => ({
  ...category,
  category: typeof category.category === 'string' && category.category.trim() ? category.category : 'Uncategorized',
  cameIn: count(category.cameIn),
  wentOut: count(category.wentOut),
  count: count(category.count),
  fieldAvailability: {
    cameIn: hasNumber(category.cameIn),
    wentOut: hasNumber(category.wentOut),
    count: hasNumber(category.count)
  }
}));

export function normalizeMoneyCenterOverview(input = {}) {
  const raw = input && typeof input === 'object' ? input : {};
  const attention = raw.attention || {};
  const requiredLists = ['properties', 'categories', 'recentItems', 'explanations', 'taxPreparationChecklist'];
  const requiredNumbers = ['cameIn', 'dueNow', 'wentOut', 'recordedNetCashFlow', 'upcomingObligations', 'projectedAfterUpcoming'];
  const fieldAvailability = Object.fromEntries(requiredNumbers.map((key) => [key, hasNumber(raw[key])]));
  fieldAvailability.cameInDetail = hasNumber(raw.cameInDetail?.amount) && hasNumber(raw.cameInDetail?.count);
  fieldAvailability.dueNowDetail = hasNumber(raw.dueNowDetail?.amount) && hasNumber(raw.dueNowDetail?.count);
  fieldAvailability.wentOutDetail = hasNumber(raw.wentOutDetail?.amount) && hasNumber(raw.wentOutDetail?.count);
  fieldAvailability.upcomingDetail = hasNumber(raw.upcomingDetail?.amount) && hasNumber(raw.upcomingDetail?.count);
  const sectionAvailability = Object.fromEntries(requiredLists.map((key) => [key, Array.isArray(raw[key])]));
  const attentionAvailability = {
    uncategorizedCount: hasNumber(raw.attention?.uncategorizedCount),
    missingReceiptCount: hasNumber(raw.attention?.missingReceiptCount),
    overdueObligationCount: hasNumber(raw.attention?.overdueObligationCount),
    settlementCount: hasNumber(raw.attention?.settlementCount)
  };
  const properties = normalizeProperties(raw.properties);
  const categories = normalizeCategories(raw.categories);
  const nestedCashFlowIsPartial = properties.some((property) =>
    Object.values(property.fieldAvailability).some((available) => !available) || !property.unitsAvailable ||
    property.units.some((unit) => Object.values(unit.fieldAvailability).some((available) => !available))) ||
    categories.some((category) => Object.values(category.fieldAvailability).some((available) => !available));
  return {
    ...raw,
    cameIn: count(raw.cameIn), dueNow: count(raw.dueNow), wentOut: count(raw.wentOut),
    recordedNetCashFlow: count(raw.recordedNetCashFlow), upcomingObligations: count(raw.upcomingObligations),
    projectedAfterUpcoming: count(raw.projectedAfterUpcoming),
    cameInDetail: normalizeAmountCount(raw.cameInDetail, raw.cameIn),
    dueNowDetail: normalizeAmountCount(raw.dueNowDetail, raw.dueNow),
    wentOutDetail: normalizeAmountCount(raw.wentOutDetail, raw.wentOut),
    upcomingDetail: normalizeAmountCount(raw.upcomingDetail, raw.upcomingObligations),
    properties, categories, recentItems: list(raw.recentItems),
    explanations: list(raw.explanations), taxPreparationChecklist: list(raw.taxPreparationChecklist),
    attention: {
      ...attention,
      uncategorizedCount: count(attention.uncategorizedCount),
      missingReceiptCount: count(attention.missingReceiptCount),
      overdueObligationCount: count(attention.overdueObligationCount),
      settlementCount: count(attention.settlementCount)
    },
    dataQuality: { ...(raw.dataQuality || {}), warnings: list(raw.dataQuality?.warnings) },
    fieldAvailability,
    sectionAvailability,
    attentionAvailability,
    isPartial: Object.values(sectionAvailability).some((available) => !available) ||
      Object.values(fieldAvailability).some((available) => !available) ||
      Object.values(attentionAvailability).some((available) => !available) || nestedCashFlowIsPartial ||
      !raw.dataQuality || !Array.isArray(raw.dataQuality?.warnings)
  };
}

export function normalizeMoneyCenterItemsResponse(raw = {}) {
  const items = list(raw?.items);
  const totalCountAvailable = hasNumber(raw?.totalCount);
  const suppliedTotalCount = totalCountAvailable ? Math.max(0, count(raw.totalCount)) : items.length;
  const totalCountConsistent = suppliedTotalCount >= items.length;
  return {
    ...(raw && typeof raw === 'object' ? raw : {}),
    items,
    totalCount: Math.max(items.length, suppliedTotalCount),
    disclosures: list(raw?.disclosures),
    isPartial: !Array.isArray(raw?.items) || !totalCountAvailable || !totalCountConsistent || !Array.isArray(raw?.disclosures)
  };
}

export function filterMoneyCenterItems(items, filter = {}) {
  const category = filter.category?.toLowerCase();
  return list(items).filter((item) => {
    if (filter.direction && item.direction !== filter.direction) return false;
    if (filter.propertyId && Number(item.propertyId) !== Number(filter.propertyId)) return false;
    if (filter.unitId && Number(item.unitId) !== Number(filter.unitId)) return false;
    if (category && String(item.category).toLowerCase() !== category) return false;
    if (filter.sourceId && item.sourceId !== filter.sourceId) return false;
    if (filter.attention === 'missingReceipt' && !(item.direction === 'wentOut' && item.sourceType === 'expense' && item.hasReceipt === false)) return false;
    if (filter.attention === 'uncategorized' && !(item.direction === 'wentOut' && String(item.category).toLowerCase() === 'uncategorized')) return false;
    if (filter.attention === 'overdue' && !(item.direction === 'obligation' && item.needsAttention)) return false;
    if (filter.attention === 'settlement' && !(item.sourceType === 'payment' && item.needsAttention)) return false;
    return true;
  });
}

export const moneyCenterPeriodLabel = (period) => ({
  'this-month': 'This month', 'last-month': 'Last month', ytd: 'Year to date',
  'last-year': 'Last year', custom: 'Custom'
}[period] || 'This month');
