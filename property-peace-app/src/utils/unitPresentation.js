const UNIT_STATUS_PRESENTATIONS = {
  occupied: { label: 'Occupied', tone: 'success' },
  overdue: { label: 'Payment overdue', tone: 'error' },
  draft: { label: 'Draft lease', tone: 'warning' },
  notstarted: { label: 'Upcoming lease', tone: 'info' },
  vacant: { label: 'Vacant', tone: 'neutral' }
};

export function getUnitStatusPresentation(status) {
  const normalized = String(status || '').replace(/[\s_-]/g, '').toLowerCase();
  return UNIT_STATUS_PRESENTATIONS[normalized] || UNIT_STATUS_PRESENTATIONS.vacant;
}

export function getLeasePagePath(leaseId) {
  const numericLeaseId = Number(leaseId);
  return Number.isSafeInteger(numericLeaseId) && numericLeaseId > 0
    ? `/landlord/leases/${numericLeaseId}`
    : null;
}
