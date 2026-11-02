import { buildLeasePaymentSchedule } from './leasePaymentSchedule.js';

const dateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const rentPayment = (payment) => {
  const type = String(payment.type ?? payment.Type ?? '').toLowerCase();
  const status = String(payment.status ?? payment.Status ?? '').toLowerCase();
  return !payment.feeId && !payment.FeeId && !payment.depositId && !payment.DepositId &&
    !type.includes('fee') && !type.includes('deposit') &&
    (!status || ['completed', 'paid', 'succeeded', 'success'].includes(status));
};

// Allocate completed rent payments oldest-first across the actual due-date schedule,
// including a prorated first installment where applicable.
export const buildLeasePaymentTimeline = (lease, payments = [], now = new Date(), isDraft = false) => {
  const cycles = buildLeasePaymentSchedule(lease).cycles;
  const grace = Number(lease?.lateFeeGracePeriod ?? lease?.LateFeeGracePeriod ?? 5);
  const graceDays = Number.isFinite(grace) ? Math.max(0, grace) : 5;
  const today = dateOnly(now);
  const milestones = (payments || []).filter(rentPayment)
    .map((payment) => ({ date: dateOnly(payment.paymentDate ?? payment.PaymentDate), amount: Number(payment.amount ?? payment.Amount) }))
    .filter(({ date, amount }) => date && Number.isFinite(amount) && amount > 0)
    .sort((a, b) => a.date - b.date);

  let collected = 0;
  const totals = milestones.map(({ date, amount }) => {
    collected += amount;
    return { date, total: Math.round(collected * 100) };
  });
  let required = 0;
  return cycles.map((cycle) => {
    required += cycle.amount;
    const due = dateOnly(cycle.dueDate);
    const deadline = new Date(due);
    deadline.setDate(deadline.getDate() + graceDays);
    const paidAt = isDraft ? null : totals.find((milestone) => milestone.total >= Math.round(required * 100))?.date;
    const status = paidAt ? (paidAt > deadline ? 'late' : 'on-time')
      : !isDraft && today > deadline ? 'overdue' : 'upcoming';
    return { ...cycle, status, paidAt };
  });
};
