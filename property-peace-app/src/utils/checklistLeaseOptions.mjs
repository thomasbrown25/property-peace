const dateKey = (value) => value ? String(value).slice(0, 10) : '';
const todayKey = (now) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export function findLinkedChecklist(checklists, leaseId, type) {
  if (!leaseId || !type) return null;
  const checklistType = type === 'move-in' ? 40 : 41;
  return checklists.find((checklist) => String(checklist.leaseId) === String(leaseId) && Number(checklist.checklistType) === checklistType) || null;
}

export function getLeaseOptions(leases, unitId, now = new Date()) {
  const today = todayKey(now);
  const options = leases
    .filter((lease) => lease.id && !lease.isDrafted && !lease.leaseAgreement?.isDrafted && (unitId == null || String(lease.unitId) === String(unitId)))
    .map((lease) => {
      const start = dateKey(lease.startDate);
      const end = dateKey(lease.endDate);
      const status = lease.isActive && start && start <= today && (!end || end >= today)
        ? 'Active'
        : lease.isActive && start > today ? 'Upcoming' : 'Recent';
      return { lease, status };
    });
  const active = options.filter(({ status }) => status === 'Active').sort((a, b) => dateKey(b.lease.startDate).localeCompare(dateKey(a.lease.startDate)));
  const upcoming = options.filter(({ status }) => status === 'Upcoming').sort((a, b) => dateKey(a.lease.startDate).localeCompare(dateKey(b.lease.startDate)));
  const recent = options.filter(({ status }) => status === 'Recent').sort((a, b) => dateKey(b.lease.endDate || b.lease.startDate).localeCompare(dateKey(a.lease.endDate || a.lease.startDate))).slice(0, 5);
  return [...active, ...upcoming, ...recent];
}

export function suggestLeaseId(options, checklists, type) {
  if (!type) return null;
  const available = options.filter(({ lease }) => !findLinkedChecklist(checklists, lease.id, type));
  return (available.find(({ status }) => status === 'Active') ||
    available.find(({ status }) => status === (type === 'move-in' ? 'Upcoming' : 'Recent')))?.lease.id ?? null;
}

export function leaseDates(lease) {
  const format = (value) => {
    const key = dateKey(value);
    if (!key) return 'Open-ended';
    const [year, month, day] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
  };
  return `${format(lease.startDate)} – ${format(lease.endDate)}`;
}
