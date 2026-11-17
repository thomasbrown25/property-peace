const read = (record, key) => record?.[key] ?? record?.[key[0].toUpperCase() + key.slice(1)];
const amount = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);

// Use period-allocated rent credits, never payment dates or balances that include arrears/fees.
export function propertyHeaderMetrics(records = [], propertyId) {
  const scoped = records.filter((record) => propertyId != null && String(read(record, 'propertyId')) === String(propertyId));
  const expected = scoped.reduce((sum, record) => sum + amount(read(record, 'currentMonthExpected')), 0);
  const collected = scoped.reduce(
    (sum, record) => sum + Math.min(amount(read(record, 'currentMonthExpected')), amount(read(record, 'currentMonthCollected'))),
    0
  );
  const remaining = Math.max(0, expected - collected);
  // Total unpaid rent for the current month plus prior-period arrears. OverdueAmount
  // can already include current-month rent after its grace deadline, so don't add it twice.
  const priorOverdue = scoped.reduce((sum, record) => sum + amount(read(record, 'priorPeriodOverdueRent')), 0);
  const scheduledRent = scoped.reduce((sum, record) => sum + amount(read(record, 'rentAmount')), 0);
  const pastDue = scoped.reduce((sum, record) => sum + amount(read(record, 'overdueAmount')), 0);
  // Compare overdue rent with the normal monthly amount; keep the collection percentage separate.
  const normalDue = expected || scheduledRent;
  return {
    expected,
    collected,
    remaining,
    dueAmount: priorOverdue + remaining,
    percent: expected > 0 ? Math.min(100, (collected / expected) * 100) : 0,
    overduePercent: pastDue > 0 && normalDue > 0 ? -Math.min(100, (pastDue / normalDue) * 100) : 0,
    scheduledRent,
    pastDue
  };
}
