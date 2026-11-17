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

export const firstOfCycleMonth = (dueDate) => {
  const match = String(dueDate).match(/^(\d{4})-(\d{2})-/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : null;
};

const rentPayment = (payment) => {
  const type = String(payment.type ?? payment.Type ?? '').toLowerCase();
  const status = String(payment.status ?? payment.Status ?? '').toLowerCase();
  return !payment.feeId && !payment.FeeId && !payment.depositId && !payment.DepositId &&
    !type.includes('fee') && !type.includes('deposit') &&
    (!status || ['completed', 'paid', 'succeeded', 'success'].includes(status));
};

// Allocate each receipt across scheduled installments oldest-first, matching the
// cumulative accounting used for the timeline. A single receipt can span months.
export const paymentsForLeaseCycle = (lease, payments, cycleIndex) => {
  const cycles = buildLeasePaymentSchedule(lease).cycles;
  if (!cycles[cycleIndex]) return [];
  const lower = Math.round(cycles.slice(0, cycleIndex).reduce((sum, cycle) => sum + cycle.amount, 0) * 100);
  const upper = lower + Math.round(cycles[cycleIndex].amount * 100);
  let collected = 0;
  return (payments || []).filter(rentPayment)
    .filter((payment) => dateOnly(payment.paymentDate ?? payment.PaymentDate) && Number(payment.amount ?? payment.Amount) > 0)
    .sort((a, b) => dateOnly(a.paymentDate ?? a.PaymentDate) - dateOnly(b.paymentDate ?? b.PaymentDate))
    .map((payment) => {
      const start = collected;
      collected += Math.round(Number(payment.amount ?? payment.Amount) * 100);
      return { payment, appliedAmount: Math.max(0, Math.min(collected, upper) - Math.max(start, lower)) / 100 };
    })
    .filter(({ appliedAmount }) => appliedAmount > 0);
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
