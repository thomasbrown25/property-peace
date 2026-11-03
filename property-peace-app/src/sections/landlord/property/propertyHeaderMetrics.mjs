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
  return {
    expected,
    collected,
    remaining: Math.max(0, expected - collected),
    percent: expected > 0 ? Math.min(100, (collected / expected) * 100) : 0,
    scheduledRent: scoped.reduce((sum, record) => sum + amount(read(record, 'rentAmount')), 0),
    pastDue: scoped.reduce((sum, record) => sum + amount(read(record, 'overdueAmount')), 0)
  };
}
