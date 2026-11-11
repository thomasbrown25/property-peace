import { buildLeasePaymentSchedule } from './leasePaymentSchedule.js';

const day = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isCompletedRent = (payment) => {
  const type = String(payment.type ?? payment.Type ?? '').toLowerCase();
  const status = String(payment.status ?? payment.Status ?? '').toLowerCase();
  const amount = Number(payment.amount ?? payment.Amount);
  return amount > 0 && !payment.depositId && !payment.DepositId && !payment.feeId && !payment.FeeId &&
    !type.includes('deposit') && !type.includes('fee') &&
    (!status || ['completed', 'paid', 'succeeded', 'success'].includes(status)) &&
    !String(payment.method ?? payment.Method ?? '').toLowerCase().includes('adjustment');
};

export const getLeasePaymentOrigin = (payment) => {
  const method = String(payment.method ?? payment.Method ?? '').trim().toLowerCase();
  const normalizedMethod = method.replace(/[\s_-]/g, '');
  // A saved card, ACH method, or creator ID does not prove an automatic payment.
  if (['autopay', 'autopayment'].includes(normalizedMethod)) return 'auto-payment';
  if (payment.stripePaymentIntentId || payment.StripePaymentIntentId ||
      payment.stripeChargeId || payment.StripeChargeId) return 'tenant-payment';
  if (['onlinepayment', 'stripe', 'tenantpayment'].includes(normalizedMethod)) return 'tenant-payment';
  if (['manual', 'manualentry', 'manualpayment', 'cash', 'check', 'cheque', 'banktransfer', 'moneyorder'].includes(normalizedMethod)) return 'manual entry';
  // Legacy records without source evidence must not be presented as automatic.
  return null;
};

// A payment is on time or late only when it completes a scheduled rent installment.
// A partial payment has no installment-level timing yet; online is not proof of auto-pay.
export function describeLeasePaymentActivity(lease, payments = [], isDraft = false) {
  const results = payments.map((payment) => ({ payment, origin: getLeasePaymentOrigin(payment), timing: null }));
  if (isDraft) return results;
  const cycles = buildLeasePaymentSchedule(lease).cycles;
  if (!cycles.length) return results;
  const grace = Number(lease?.lateFeeGracePeriod ?? lease?.LateFeeGracePeriod ?? 5);
  const graceDays = Number.isFinite(grace) ? Math.max(0, grace) : 5;
  const ordered = results.filter(({ payment }) => isCompletedRent(payment) && day(payment.paymentDate ?? payment.PaymentDate))
    .sort((a, b) => day(a.payment.paymentDate ?? a.payment.PaymentDate) - day(b.payment.paymentDate ?? b.payment.PaymentDate));
  let collectedCents = 0;
  let thresholdCents = 0;
  let cycleIndex = 0;
  for (const item of ordered) {
    collectedCents += Math.round(Number(item.payment.amount ?? item.payment.Amount) * 100);
    const paidAt = day(item.payment.paymentDate ?? item.payment.PaymentDate);
    const statuses = [];
    while (cycleIndex < cycles.length) {
      const required = thresholdCents + Math.round(cycles[cycleIndex].amount * 100);
      if (collectedCents < required) break;
      thresholdCents = required;
      const deadline = day(cycles[cycleIndex].dueDate);
      deadline.setDate(deadline.getDate() + graceDays);
      statuses.push(paidAt > deadline ? 'late' : 'on-time');
      cycleIndex++;
    }
    item.timing = statuses.length && statuses.every((status) => status === statuses[0]) ? statuses[0] : null;
  }
  return results;
}
