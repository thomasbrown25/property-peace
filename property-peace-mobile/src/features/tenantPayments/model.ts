import type { PayReadiness, TenantLease, TenantPayment, TenantRent } from '../../api/tenantPaymentsAPI';

export function billForLease(lease: TenantLease | null, rent: TenantRent | null): { leaseId: number; amount: number; dueDate: string | null } | null {
  if (!lease || !rent || rent.leaseId !== lease.id || !Number.isFinite(rent.rentDue) || rent.rentDue < 0) return null;
  return { leaseId: lease.id, amount: rent.rentDue, dueDate: rent.currentMonthRentDueDate ?? rent.dueDate ?? null };
}
export function canPayRent(lease: TenantLease | null, rent: TenantRent | null, readiness: PayReadiness | null): boolean {
  const bill = billForLease(lease, rent);
  return !!(bill && bill.amount > 0 && lease?.isActive === true && lease.rentCollectionByPlatform === true && readiness?.allowed === true && readiness.blockers.length === 0 && !rent?.processingPaymentCount);
}
export function paymentStatus(payment: Pick<TenantPayment, 'status'>): string {
  const value = String(payment.status ?? '').toLowerCase();
  switch (value) {
    case 'paid': case 'completed': return 'Paid';
    case 'processing': return 'Processing';
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
