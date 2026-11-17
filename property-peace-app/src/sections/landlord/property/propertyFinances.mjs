import { isDetachedSingleUnitType } from '../../../utils/propertyType.js';

export const hasFinanceUnits = property =>
  (property?.units?.length ?? property?.Units?.length ?? 0) > 1 ||
  !isDetachedSingleUnitType(property?.propertyType ?? property?.PropertyType);

export function financeUnitName(record, property) {
  const unitId = record.unitId ?? record.UnitId ?? record.lease?.unitId;
  const unit = (property?.units ?? property?.Units ?? []).find(item => String(item.id ?? item.Id) === String(unitId));
  return record.unitName || record.UnitName || record.lease?.unitName || unit?.name || unit?.Name || (unitId != null ? `Unit #${unitId}` : 'Property-wide');
}

export const paymentCategory = record => record.depositId != null || String(record.type).toLowerCase() === 'deposit'
  ? 'Deposit' : record.feeId != null ? record.feeName || 'Fee' : 'Rent payment';

export function paymentTenantName(record, property) {
  const name = record.tenantName || record.lease?.tenantName;
  if (name?.trim()) return name.trim();
  const leaseId = record.leaseId ?? record.LeaseId ?? record.lease?.id;
  if (leaseId == null) return '—';
  const leases = [property?.lease, ...(property?.leases ?? []),
    ...(property?.units ?? []).flatMap(unit => [unit.lease, ...(unit.leases ?? [])])];
  const lease = leases.find(item => item && String(item.id ?? item.Id) === String(leaseId));
  const tenant = (lease?.tenants ?? lease?.Tenants ?? [])[0];
  const tenantName = [tenant?.firstname ?? tenant?.firstName ?? tenant?.Firstname,
    tenant?.lastname ?? tenant?.lastName ?? tenant?.Lastname].filter(Boolean).join(' ').trim();
  return tenantName || '—';
}

export function combinePropertyFinances(payments = [], expenses = [], propertyId) {
  const matchesProperty = record => {
    const id = record.propertyId ?? record.PropertyId ?? record.property?.id ?? record.lease?.propertyId;
    return id == null || String(id) === String(propertyId);
  };
  return [
    ...payments.filter(matchesProperty).map(record => ({ kind: 'income', record, date: record.paymentDate || record.date })),
    ...expenses.filter(matchesProperty).map(record => ({ kind: 'expense', record, date: record.expenseDate }))
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}
