import { calendarDate, incumbentLease } from '../../../utils/successorLease.mjs';

// Unit.lease is the current projection; the property lease list contains distinct contracts.
// Do not derive occupancy from this list. On a same-day boundary the outgoing
// contract stays current through its end date, so the incoming one is scheduled.
export function scheduledPropertyLeases(property, leases, today) {
  const day = calendarDate(today);
  if (!day || !Array.isArray(leases)) return [];
  const units = property?.units ?? property?.Units ?? [];
  const byId = new Map(units.map((unit) => [String(unit.id ?? unit.Id), unit]));
  return leases.filter((lease) => {
    const id = lease?.id ?? lease?.Id;
    const unit = byId.get(String(lease?.unitId ?? lease?.UnitId));
    const start = calendarDate(lease?.startDate ?? lease?.StartDate);
    if (!id || !unit || !start || lease.isActive === false || lease.IsActive === false ||
        lease.isDrafted === true || lease.IsDrafted === true || lease.isDeleted === true || lease.IsDeleted === true) return false;
    const incumbent = incumbentLease(unit);
    if (String(incumbent?.id ?? incumbent?.Id) === String(id)) return false;
    if (start > day) return true;
    const incumbentEnd = calendarDate(incumbent?.endDate ?? incumbent?.EndDate);
    return start === day && incumbentEnd === day;
  }).sort((a, b) => String(a.startDate ?? a.StartDate).localeCompare(String(b.startDate ?? b.StartDate)));
}
