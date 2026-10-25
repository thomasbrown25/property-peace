import type { TenantLease } from '../../api/tenantPaymentsAPI';

export type LeaseView = 'active' | 'history';

// The tenant endpoint returns all non-deleted leases, including inactive records.
// Do not use the landlord's lease list: it is not scoped to the signed-in tenant.
export function leasesForView(leases: TenantLease[], view: LeaseView): TenantLease[] {
  return leases.filter(lease => (lease.isActive === true) === (view === 'active'));
}

export function tenantLeaseDate(value?: string | null): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 'Not set';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[0]) return 'Not set';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export const tenantLeaseMoney = (amount?: number | null): string =>
  typeof amount === 'number' && Number.isFinite(amount)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
    : 'Not set';
