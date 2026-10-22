import { normalizeRentCollectionMetrics } from './rentCollectionMetrics.js';

const read = (value, camel, pascal) => value?.[camel] ?? value?.[pascal];
const OPEN_STATUS = new Set(['completed', 'cancelled', 'closed', 'resolved']);

export function mobileDashboardData({ properties = [], requests = [], summary, rentRecords, conversations = [] }) {
  const openRequests = requests.filter((request) => !OPEN_STATUS.has(String(read(request, 'status', 'Status') ?? '').toLowerCase().replace(/[-_\s]/g, '')));
  const repairs = new Map();
  for (const request of openRequests) {
    const id = read(request, 'propertyId', 'PropertyId');
    if (id != null) repairs.set(String(id), (repairs.get(String(id)) ?? 0) + 1);
  }
  const unread = conversations.reduce((sum, item) => sum + (read(item, 'isArchived', 'IsArchived') ? 0 : Math.max(0, Number(read(item, 'unreadCount', 'UnreadCount')) || 0)), 0);
  const metrics = normalizeRentCollectionMetrics(summary);
  const overdue = read(summary, 'overdue', 'Overdue');
  let propertyBalances = null;
  if (Array.isArray(rentRecords) && typeof overdue === 'number' && Number.isFinite(overdue) && overdue >= 0) {
    const balances = new Map();
    let totalCents = 0;
    let valid = true;
    for (const record of rentRecords) {
      const id = read(record, 'propertyId', 'PropertyId');
      const amount = read(record, 'overdueAmount', 'OverdueAmount');
      if (id == null || String(id) === '' || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) { valid = false; break; }
      const cents = Math.round(amount * 100);
      balances.set(String(id), (balances.get(String(id)) ?? 0) + cents);
      totalCents += cents;
    }
    if (valid && totalCents === Math.round(overdue * 100)) propertyBalances = balances;
  }
  const rows = properties.filter((p) => read(p, 'isActive', 'IsActive') !== false).slice(0, 5).map((property) => {
    const id = String(read(property, 'id', 'Id') ?? '');
    const cents = propertyBalances?.get(id) ?? 0;
    return {
      id,
      name: read(property, 'name', 'Name') || read(property, 'streetAddress', 'StreetAddress') || 'Unnamed property',
      repairs: repairs.get(id) ?? 0,
      overdue: propertyBalances === null ? null : cents / 100
    };
  });
  return { openRepairs: openRequests.length, unread, metrics, overdue, rows, balancesAvailable: propertyBalances !== null };
}
