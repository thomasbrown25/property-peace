const list = (value) => Array.isArray(value) ? value : [];
const paymentDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});

export const readPayment = (payment, camel, pascal) => payment?.[camel] ?? payment?.[pascal];
export const getPaymentId = (payment) => readPayment(payment, 'id', 'Id');
export const getPaymentAmount = (payment) => {
  const amount = Number(readPayment(payment, 'amount', 'Amount') ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

export function buildFinancesPaymentRequestScope(propertyId, unitId) {
  const params = {
    ...(propertyId ? { propertyId } : {}),
    ...(unitId ? { unitId } : {})
  };
  return {
    key: `${propertyId ?? 'all'}:${unitId ?? 'all'}`,
    params: Object.keys(params).length ? params : undefined
  };
}

export function normalizePaymentStatus(payment) {
  const status = String(readPayment(payment, 'status', 'Status') || 'Completed').trim().toLowerCase();
  if (['completed', 'succeeded', 'paid'].includes(status)) return 'completed';
  if (status === 'failed') return 'failed';
  if (['canceled', 'cancelled'].includes(status)) return 'canceled';
  if (status === 'disputed') return 'disputed';
  return 'processing';
}

export function getPaymentType(payment) {
  if (readPayment(payment, 'feeId', 'FeeId')) return 'fee';
  if (readPayment(payment, 'depositId', 'DepositId')) return 'deposit';
  return 'rent';
}

export function isOnlinePayment(payment) {
  const reference = String(readPayment(payment, 'reference', 'Reference') || '');
  return Boolean(
    readPayment(payment, 'stripePaymentIntentId', 'StripePaymentIntentId') ||
    readPayment(payment, 'stripePaymentMethodId', 'StripePaymentMethodId') ||
    readPayment(payment, 'stripeChargeId', 'StripeChargeId') ||
    /- Amount:\s*\$/i.test(reference)
  );
}

export function getPaymentReference(payment) {
  const reference = String(readPayment(payment, 'reference', 'Reference') || '')
    .replace(/\s*-\s*Amount:\s*\$[\d,.]+/i, '')
    .trim();
  if (reference) return reference;
  const type = getPaymentType(payment);
  if (type === 'fee') return readPayment(payment, 'feeName', 'FeeName') || 'Lease fee';
  if (type === 'deposit') return 'Security deposit';
  return 'Rent payment';
}

export function getPaymentTitle(payment) {
  const tenantName = readPayment(payment, 'tenantName', 'TenantName');
  if (tenantName) return tenantName;
  const type = getPaymentType(payment);
  if (type === 'fee') return readPayment(payment, 'feeName', 'FeeName') || 'Fee payment';
  if (type === 'deposit') return 'Deposit payment';
  return 'Rent payment';
}

export function getPaymentLocation(payment) {
  const propertyName = readPayment(payment, 'propertyName', 'PropertyName') || 'No property';
  const unitName = readPayment(payment, 'unitName', 'UnitName');
  const singleUnit = Boolean(readPayment(payment, 'isSingleUnitProperty', 'IsSingleUnitProperty'));
  return !unitName || singleUnit ? propertyName : `${propertyName} · ${unitName}`;
}

export function getPaymentMethod(payment) {
  const method = readPayment(payment, 'method', 'Method');
  if (method) return method;
  return isOnlinePayment(payment) ? 'Online payment' : 'Manual entry';
}

export function getPaymentStatusPresentation(status) {
  if (status === 'completed') return { label: 'Completed', color: 'success' };
  if (status === 'failed') return { label: 'Failed', color: 'error' };
  if (status === 'canceled') return { label: 'Canceled', color: 'default' };
  if (status === 'disputed') return { label: 'Disputed', color: 'error' };
  return { label: 'Processing', color: 'warning' };
}

export function formatPaymentDate(value) {
  if (!value) return 'Date not set';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Date not set' : paymentDateFormatter.format(date);
}

const paymentTimestamp = (payment) => {
  const timestamp = Date.parse(readPayment(payment, 'paymentDate', 'PaymentDate') || '');
  return Number.isNaN(timestamp) ? null : timestamp;
};

const isInSharedScope = (payment, { propertyId, unitId, from, to }) => {
  if (propertyId && Number(readPayment(payment, 'propertyId', 'PropertyId')) !== Number(propertyId)) return false;
  if (unitId && Number(readPayment(payment, 'unitId', 'UnitId')) !== Number(unitId)) return false;
  const fromTimestamp = Date.parse(from || '');
  const toTimestamp = Date.parse(to || '');
  if (Number.isNaN(fromTimestamp) && Number.isNaN(toTimestamp)) return true;
  const timestamp = paymentTimestamp(payment);
  if (timestamp === null) return false;
  if (!Number.isNaN(fromTimestamp) && timestamp < fromTimestamp) return false;
  if (!Number.isNaN(toTimestamp) && timestamp >= toTimestamp) return false;
  return true;
};

const searchText = (payment) => [
  getPaymentTitle(payment),
  getPaymentReference(payment),
  getPaymentLocation(payment),
  getPaymentMethod(payment),
  readPayment(payment, 'feeName', 'FeeName'),
  normalizePaymentStatus(payment),
  getPaymentType(payment)
].filter(Boolean).join(' ').toLocaleLowerCase();

const matchesStatus = (payment, status) => {
  const normalized = normalizePaymentStatus(payment);
  if (status === 'attention') return ['failed', 'canceled', 'disputed'].includes(normalized);
  return status === 'all' || normalized === status;
};

export function selectPaymentsPage(payments, filters = {}) {
  const query = String(filters.search || '').trim().toLocaleLowerCase();
  const type = filters.type || 'all';
  const status = filters.status || 'all';
  const source = filters.source || 'all';
  const sort = filters.sort || 'newest';
  const pageSize = Number.isSafeInteger(filters.pageSize) && filters.pageSize > 0 ? filters.pageSize : 10;
  const scopedPayments = list(payments).filter((payment) => isInSharedScope(payment, filters));
  const filteredPayments = scopedPayments
    .filter((payment) => !query || searchText(payment).includes(query))
    .filter((payment) => type === 'all' || getPaymentType(payment) === type)
    .filter((payment) => matchesStatus(payment, status))
    .filter((payment) => source === 'all' || (source === 'online' ? isOnlinePayment(payment) : !isOnlinePayment(payment)))
    .sort((a, b) => {
      if (sort === 'amount-high') return getPaymentAmount(b) - getPaymentAmount(a);
      if (sort === 'amount-low') return getPaymentAmount(a) - getPaymentAmount(b);
      if (sort === 'property') return getPaymentLocation(a).localeCompare(getPaymentLocation(b));
      const aDate = paymentTimestamp(a) ?? 0;
      const bDate = paymentTimestamp(b) ?? 0;
      return sort === 'oldest' ? aDate - bDate : bDate - aDate;
    });
  const totalCount = filteredPayments.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const requestedPage = Number(filters.page);
  const page = Math.min(totalPages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const visiblePayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);
  return {
    unfilteredCount: scopedPayments.length,
    totalCount,
    totalPages,
    page,
    filteredPayments,
    visiblePayments
  };
}

export function buildPaymentCsvRows(payments) {
  return list(payments).map((payment) => ({
    Date: formatPaymentDate(readPayment(payment, 'paymentDate', 'PaymentDate')),
    Tenant: readPayment(payment, 'tenantName', 'TenantName') || '',
    Reference: getPaymentReference(payment),
    Type: getPaymentType(payment),
    Property: readPayment(payment, 'propertyName', 'PropertyName') || '',
    Unit: readPayment(payment, 'isSingleUnitProperty', 'IsSingleUnitProperty') ? '' : readPayment(payment, 'unitName', 'UnitName') || '',
    Method: getPaymentMethod(payment),
    Source: isOnlinePayment(payment) ? 'Online' : 'Manual',
    Status: getPaymentStatusPresentation(normalizePaymentStatus(payment)).label,
    Amount: getPaymentAmount(payment)
  }));
}

export function maskPaymentMetricsAvailability(overview, paymentsAvailable) {
  if (!overview || paymentsAvailable) return overview;
  return {
    ...overview,
    fieldAvailability: {
      ...overview.fieldAvailability,
      cameIn: false,
      recordedNetCashFlow: false
    }
  };
}
