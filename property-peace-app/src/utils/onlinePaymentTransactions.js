const read = (value, camel, pascal) => value?.[camel] ?? value?.[pascal];

const titleCase = (value) =>
  String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

export function normalizeOnlinePaymentStatus(transaction) {
  const status = String(read(transaction, 'status', 'Status') || '')
    .trim()
    .toLowerCase()
    .replaceAll('_', '')
    .replaceAll('-', '')
    .replaceAll(' ', '');
  if (['completed', 'succeeded', 'paid', 'success'].includes(status)) return 'completed';
  if (['failed', 'requirespaymentmethod'].includes(status)) return 'failed';
  if (['canceled', 'cancelled'].includes(status)) return 'canceled';
  if (status === 'disputed') return 'disputed';
  if (status === 'refunded') return 'refunded';
  if (status === 'partiallyrefunded') return 'partially-refunded';
  return 'processing';
}

export function getOnlinePaymentStatusPresentation(status) {
  if (status === 'completed') return { label: 'Completed', color: 'success' };
  if (status === 'failed') return { label: 'Failed', color: 'error' };
  if (status === 'canceled') return { label: 'Canceled', color: 'default' };
  if (status === 'disputed') return { label: 'Disputed', color: 'error' };
  if (status === 'refunded') return { label: 'Refunded', color: 'info' };
  if (status === 'partially-refunded') return { label: 'Partially refunded', color: 'info' };
  return { label: 'Processing', color: 'warning' };
}

export function getOnlinePaymentMethodLabel(transaction) {
  const type = String(read(transaction, 'paymentMethodType', 'PaymentMethodType') || '').toLowerCase();
  const brand = read(transaction, 'paymentMethodBrand', 'PaymentMethodBrand');
  const bankName = read(transaction, 'paymentMethodBankName', 'PaymentMethodBankName');
  const wallet = read(transaction, 'paymentMethodWalletType', 'PaymentMethodWalletType');
  const last4 = read(transaction, 'paymentMethodLast4', 'PaymentMethodLast4');
  const suffix = last4 ? ` •••• ${last4}` : '';

  if (type === 'us_bank_account' || type === 'ach') return `${bankName || 'ACH'} bank${suffix}`;
  if (wallet) return `${titleCase(wallet)}${suffix}`;
  if (brand) return `${titleCase(brand)}${suffix}`;
  if (type) return `${titleCase(type)}${suffix}`;
  return 'Online payment';
}

export function buildOnlineTransactionRows(transactions) {
  return (Array.isArray(transactions) ? transactions : [])
    .filter((transaction) => Boolean(read(transaction, 'paymentIntentId', 'PaymentIntentId')))
    .map((transaction) => {
      const propertyName = read(transaction, 'propertyName', 'PropertyName') || 'Property';
      const unitName = read(transaction, 'unitName', 'UnitName');
      return {
        id: read(transaction, 'paymentIntentId', 'PaymentIntentId'),
        leaseId: read(transaction, 'leaseId', 'LeaseId'),
        propertyId: read(transaction, 'propertyId', 'PropertyId'),
        propertyName,
        location: unitName ? `${propertyName} · ${unitName}` : propertyName,
        tenant: read(transaction, 'tenantName', 'TenantName') || 'Renter',
        paidAt: read(transaction, 'paidAt', 'PaidAt'),
        processedAt: read(transaction, 'processedAt', 'ProcessedAt') ?? null,
        method: getOnlinePaymentMethodLabel(transaction),
        providerReference: read(transaction, 'paymentIntentId', 'PaymentIntentId'),
        status: normalizeOnlinePaymentStatus(transaction),
        amount: Number(read(transaction, 'amountCents', 'AmountCents') || 0) / 100,
        currency: String(read(transaction, 'currency', 'Currency') || 'usd').toUpperCase()
      };
    })
    .sort((a, b) => Date.parse(b.paidAt || '') - Date.parse(a.paidAt || ''));
}

export function filterOnlineTransactions(transactions, filters = {}) {
  const search = String(filters.search || '')
    .trim()
    .toLocaleLowerCase();
  const status = filters.status || 'all';
  const propertyId = filters.propertyId || 'all';

  return buildOnlineTransactionRows(transactions).filter((row) => {
    const statusMatches =
      status === 'all' || row.status === status || (status === 'attention' && ['failed', 'canceled', 'disputed'].includes(row.status));
    const propertyMatches = propertyId === 'all' || String(row.propertyId) === String(propertyId);
    if (!statusMatches || !propertyMatches) return false;
    if (!search) return true;
    const searchable = [row.tenant, row.location, row.method, row.providerReference, row.status, row.currency]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    return search.split(/\s+/).every((term) => searchable.includes(term));
  });
}

export function summarizeOnlineTransactions(transactions) {
  const rows = buildOnlineTransactionRows(transactions);
  return {
    totalCount: rows.length,
    completedAmount: rows.filter((row) => row.status === 'completed').reduce((total, row) => total + row.amount, 0),
    processingCount: rows.filter((row) => row.status === 'processing').length,
    attentionCount: rows.filter((row) => ['failed', 'canceled', 'disputed'].includes(row.status)).length,
    refundedCount: rows.filter((row) => ['refunded', 'partially-refunded'].includes(row.status)).length
  };
}
