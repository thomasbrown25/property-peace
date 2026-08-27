const RECENT_TRANSACTION_LIMIT = 6;

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];

function buildPaymentItem(payment) {
  const propertyName = read(payment, 'propertyName', 'PropertyName') || '';
  const propertyId = read(payment, 'propertyId', 'PropertyId');
  const tenantName = read(payment, 'tenantName', 'TenantName') || '';

  return {
    id: `payment-${read(payment, 'id', 'Id')}`,
    kind: 'income',
    date: read(payment, 'paymentDate', 'PaymentDate'),
    title: propertyName || 'Property not available',
    sub: tenantName,
    amount: Number(read(payment, 'amount', 'Amount') || 0),
    onClick: propertyId ? `/landlord/property/${propertyId}` : '/landlord/finances?tab=activity'
  };
}

export function buildRecentPayments(payments = []) {
  return payments
    .map(buildPaymentItem)
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, RECENT_TRANSACTION_LIMIT);
}
