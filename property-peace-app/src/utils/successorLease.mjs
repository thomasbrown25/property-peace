// Date-only lease terms: retain the calendar date supplied by the API rather than
// shifting an ISO timestamp into the browser's timezone.
export const calendarDate = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    value = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) && date.getUTCDate() === Number(day)
    ? `${year}-${month}-${day}` : null;
};

export const incumbentLease = (unit) => {
  const lease = unit?.lease ?? unit?.Lease ?? unit?.activeLease ?? unit?.ActiveLease;
  if (!lease || lease.isActive === false || lease.IsActive === false) return null;
  if (['inactive', 'ended', 'expired', 'cancelled', 'canceled', 'terminated'].includes(String(lease.status ?? lease.Status ?? '').toLowerCase())) return null;
  return lease;
};

export const successorStartError = (start, unit) => {
  const incumbent = incumbentLease(unit);
  if (!incumbent) return null;
  const end = calendarDate(incumbent.endDate ?? incumbent.EndDate);
  if (!end) return 'The current lease needs an end date before a successor can be scheduled.';
  const startDay = calendarDate(start);
  if (!startDay) return 'Enter a valid start date for the successor lease.';
  if (startDay < end) return `Start date must be on or after the current lease end date (${end}).`;
  return null;
};

export const leaseTermError = (start, end, unit) => {
  if (unit && incumbentLease(unit) && !calendarDate(start)) return successorStartError(start, unit);
  if (start && !calendarDate(start)) return 'Enter a valid start date.';
  if (end && !calendarDate(end)) return 'Enter a valid end date.';
  if (start && end && calendarDate(end) <= calendarDate(start)) return 'End date must be after start date.';
  const currentError = successorStartError(start, unit);
  if (currentError) return currentError;

  const startDay = calendarDate(start);
  const endDay = calendarDate(end);
  const currentId = incumbentLease(unit)?.id ?? incumbentLease(unit)?.Id;
  for (const lease of unit?.leases ?? unit?.Leases ?? []) {
    const id = lease?.id ?? lease?.Id;
    if (currentId != null && String(id) === String(currentId)) continue;
    if (lease?.isActive === false || lease?.IsActive === false || lease?.isDrafted === true ||
        lease?.IsDrafted === true || lease?.isDeleted === true || lease?.IsDeleted === true ||
        ['inactive', 'ended', 'expired', 'cancelled', 'canceled', 'terminated'].includes(String(lease?.status ?? lease?.Status ?? '').toLowerCase())) continue;
    const bookedStart = calendarDate(lease?.startDate ?? lease?.StartDate);
    const bookedEnd = calendarDate(lease?.endDate ?? lease?.EndDate);
    if (bookedStart && !startDay) return 'Enter a valid start date for the successor lease.';
    // Adjacent terms may meet on the same calendar date; crossing either edge is not allowed.
    if (bookedStart && startDay < (bookedEnd ?? '9999-12-31') && (!endDay || endDay > bookedStart)) {
      return `Lease term overlaps a scheduled lease starting ${bookedStart}.`;
    }
  }
  return null;
};
