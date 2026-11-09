// Occupancy is a lease fact, never a tenant count, cached flag, or payment status.
// Match the API's UTC calendar-day comparisons, with inclusive end dates.
const read = (value, camel, pascal) => value?.[camel] ?? value?.[pascal];
const enabled = (value) => value === true || value === 1;

function calendarDay(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
    if (match) {
      const [, year, month, day] = match.map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        ? date.getTime() : null;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function isActiveOccupancyLease(lease, now = new Date()) {
  if (!lease || read(lease, 'hasLease', 'HasLease') === false || !enabled(read(lease, 'isActive', 'IsActive')) ||
    enabled(read(lease, 'isDeleted', 'IsDeleted'))) return false;
  const agreement = read(lease, 'leaseAgreement', 'LeaseAgreement');
  if (enabled(read(lease, 'isDrafted', 'IsDrafted')) || enabled(read(agreement, 'isDrafted', 'IsDrafted')) ||
    String(read(lease, 'status', 'Status') || '').toLowerCase() === 'draft') return false;
  const today = calendarDay(now);
  const start = calendarDay(read(lease, 'startDate', 'StartDate'));
  const endValue = read(lease, 'endDate', 'EndDate');
  const end = calendarDay(endValue);
  return today != null && start != null && start <= today &&
    (endValue == null || endValue === '' || (end != null && end >= today));
}

export function getUnitActiveLease(unit, now = new Date()) {
  const leases = read(unit, 'leases', 'Leases');
  const candidates = [...(Array.isArray(leases) ? leases : []), read(unit, 'lease', 'Lease')].filter(Boolean);
  return candidates.filter((lease) => isActiveOccupancyLease(lease, now))
    .sort((a, b) => calendarDay(read(b, 'startDate', 'StartDate')) - calendarDay(read(a, 'startDate', 'StartDate')))[0] ?? null;
}

export function isUnitOccupied(unit, now = new Date()) {
  return getUnitActiveLease(unit, now) != null;
}

export function getPropertyOccupancy(property, now = new Date()) {
  const raw = read(property, 'units', 'Units');
  const units = (Array.isArray(raw) ? raw : []).filter((unit) => unit && !enabled(read(unit, 'isDeleted', 'IsDeleted')));
  const totalUnits = units.length;
  const occupiedUnits = units.filter((unit) => isUnitOccupied(unit, now)).length;
  return { totalUnits, occupiedUnits, vacantUnits: totalUnits - occupiedUnits,
    occupancyRate: totalUnits ? Math.round(100 * occupiedUnits / totalUnits) : 0 };
}

export function isPropertyOccupied(property, now = new Date()) {
  return getPropertyOccupancy(property, now).occupiedUnits > 0;
}
