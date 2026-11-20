import moment from 'moment';
import { classifyPaymentStatus } from '../../utils/paymentSafety.js';

const amountFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function getPaymentStatusMeta(payment) {
  switch (classifyPaymentStatus(payment).status) {
    case 'completed':
    case 'paid':
      return { label: 'Paid', tone: 'success' };
    case 'processing':
      return { label: 'Processing', tone: 'info' };
    case 'failed':
      return { label: 'Failed', tone: 'error' };
    case 'canceled':
      return { label: 'Canceled', tone: 'default' };
    case 'disputed':
      return { label: 'Disputed', tone: 'error' };
    default:
      return { label: 'Needs review', tone: 'warning' };
  }
}

export function filterPaymentHistory(payments, { search = '', fromDate = '', toDate = '' } = {}) {
  const query = search.trim().toLowerCase();
  const hasDateRange = fromDate || toDate;
  if (!query && !hasDateRange) return payments;

  return payments.filter((payment) => {
    if (hasDateRange) {
      const paymentDate = moment(payment.paymentDate ?? null);
      if (!paymentDate.isValid()) return false;
      const day = paymentDate.format('YYYY-MM-DD');
      if ((fromDate && day < fromDate) || (toDate && day > toDate)) return false;
    }
    if (!query) return true;

    const amount = payment.amount ?? 0;
    const formattedAmount = amountFormat.format(amount);
    return [
      amount,
      formattedAmount,
      formattedAmount.replace(/[$,]/g, ''),
      getPaymentStatusMeta(payment).label,
      payment.method || payment.paymentMethod,
      payment.reference || payment.referenceNumber
    ].some((value) => String(value ?? '').toLowerCase().includes(query));
  });
}
