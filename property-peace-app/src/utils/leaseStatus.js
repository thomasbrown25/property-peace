export function isLeaseDraft(lease) {
  return String(lease?.status || lease?.Status || '').toLowerCase() === 'draft' ||
    lease?.isDrafted === true ||
    lease?.IsDrafted === true ||
    lease?.leaseAgreement?.isDrafted === true ||
    lease?.leaseAgreement?.IsDrafted === true;
}

function parseLeaseDate(value) {
  if (typeof value === 'string') {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnlyMatch) {
      return new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
    }
  }
  return new Date(value);
}

export function isStartedActiveLease(lease, now = new Date()) {
  const active = lease?.isActive === true || lease?.IsActive === true || lease?.isActive === 1 || lease?.IsActive === 1;
  if (!lease || lease.hasLease === false || !active || isLeaseDraft(lease)) return false;

  const startValue = lease.startDate ?? lease.StartDate;
  if (!startValue) return false;

  const startDate = parseLeaseDate(startValue);
  if (Number.isNaN(startDate.getTime())) return false;
  startDate.setHours(0, 0, 0, 0);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  if (startDate > todayStart) return false;

  const endValue = lease.endDate ?? lease.EndDate;
  if (!endValue) return true;

  const endDate = parseLeaseDate(endValue);
  if (Number.isNaN(endDate.getTime())) return false;
  endDate.setHours(23, 59, 59, 999);
  return endDate >= todayStart;
}
