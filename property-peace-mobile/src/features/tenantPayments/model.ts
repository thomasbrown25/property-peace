import type { PayReadiness, TenantCharge, TenantLease, TenantPayment, TenantRent } from '../../api/tenantPaymentsAPI';

export function chargeDate(value?: string | null): string {
  const day = value?.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/)?.[1];
  if (!day) return '—';
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(day)
    ? parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—';
}

export function chargeBalanceLabel(charge: TenantCharge): string {
  if (charge.remaining === 0) return 'Balance settled';
  return charge.paid > 0 ? 'Partially paid' : 'Outstanding';
}

export function leaseHomeLabel(lease: TenantLease): string {
  const property = lease.propertyName?.trim() || 'Your property';
  const singleFamily = lease.propertyType?.replace(/[\s_-]/g, '').toLowerCase() === 'singlefamily';
  const unit = lease.unitName?.trim();
  return unit && !singleFamily ? `${property} · ${unit}` : property;
}

export function rentIsLate(rent: TenantRent | null): boolean {
  return !!rent && Number.isFinite(rent.rentDue) && rent.rentDue > 0 && rent.rentDueIsOverdue === true;
}

export function billForLease(lease: TenantLease | null, rent: TenantRent | null): { leaseId: number; amount: number; dueDate: string | null } | null {
  if (!lease || !rent || rent.leaseId !== lease.id || !Number.isFinite(rent.rentDue) || rent.rentDue < 0) return null;
  return { leaseId: lease.id, amount: rent.rentDue, dueDate: rent.currentMonthRentDueDate ?? rent.dueDate ?? null };
}
export function canPayRent(lease: TenantLease | null, rent: TenantRent | null, readiness: PayReadiness | null): boolean {
  const bill = billForLease(lease, rent);
  return !!(bill && bill.amount > 0 && lease?.isActive === true && lease.rentCollectionByPlatform === true && readiness?.allowed === true && readiness.blockers.length === 0 && !rent?.processingPaymentCount);
}
export function canPayFee(lease: TenantLease | null, charge: TenantCharge | null, readiness: PayReadiness | null): boolean {
  return !!(lease?.isActive === true && lease.rentCollectionByPlatform === true && readiness?.allowed === true &&
    readiness.blockers.length === 0 && charge?.type.toLowerCase() === 'fee' && /^fee:[1-9]\d*$/.test(charge.chargeId) &&
    Number.isSafeInteger(Number(charge.chargeId.slice(4))) && charge.remaining >= 0.5 &&
    !charge.payments.some(payment => !['Paid', 'Failed', 'Canceled', 'Disputed'].includes(paymentStatus(payment))));
}
export function pendingFeePayment(pending: { paymentIntentId: string; chargeId?: string; amount?: number; previousRemaining?: number } | null, history: TenantPayment[], charge?: TenantCharge | null): boolean {
  if (!pending) return false;
  const match = history.find(payment => payment.stripePaymentIntentId === pending.paymentIntentId);
  if (match && ['Paid', 'Failed', 'Canceled'].includes(paymentStatus(match))) return false;
  // The charge ledger contains only finalized receipts. It can independently prove
  // a partial fee settled even when tenant history does not expose provider IDs.
  if (charge && charge.chargeId === pending.chargeId && Number.isFinite(charge.remaining) && Number.isFinite(pending.previousRemaining) && Number.isFinite(pending.amount) &&
    pending.amount! > 0 && Math.round((pending.previousRemaining! - charge.remaining) * 100) >= Math.round(pending.amount! * 100)) return false;
  return true;
}
// Parse decimal dollars without rounding excess fractional cents into a payable amount.
export function parseRentPayment(input: string, due: number): number | null {
  if (!Number.isFinite(due) || !Number.isSafeInteger(Math.round(due * 100)) || Math.abs(due * 100 - Math.round(due * 100)) > 1e-7) return null;
  const text = input.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) return null;
  const [dollars, fraction = ''] = text.split('.');
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 50 || cents > Math.round(due * 100)) return null;
  return cents / 100;
}

export function pendingRentPayment(pending: { paymentIntentId: string; amount: number } | null, history: TenantPayment[]): boolean {
  if (!pending) return false;
  const match = history.find(payment => payment.stripePaymentIntentId === pending.paymentIntentId);
  return !match || !['Paid', 'Failed', 'Canceled'].includes(paymentStatus(match));
}

export function paymentStatus(payment: Pick<TenantPayment, 'status'>): string {
  const value = String(payment.status ?? '').toLowerCase();
  switch (value) {
    case 'paid': case 'completed': return 'Paid';
    case 'processing': return 'Processing';
    case 'received': return 'Received';
    case 'created': return 'Started';
    case 'failed': return 'Failed';
    case 'canceled': case 'cancelled': return 'Canceled';
    case 'disputed': return 'Disputed';
    default: return 'Needs review';
  }
}
export function creditedRentTotal(history: TenantPayment[]): number {
  return history.reduce((total, payment) => total + ((payment.paymentType === 'Rent' && payment.creditsRent === true && paymentStatus(payment) === 'Paid' && Number.isFinite(payment.amount) && payment.amount > 0) ? payment.amount : 0), 0);
}
