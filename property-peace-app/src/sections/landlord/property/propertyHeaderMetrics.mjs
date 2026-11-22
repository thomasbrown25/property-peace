const read = (record, key) => record?.[key] ?? record?.[key[0].toUpperCase() + key.slice(1)];
const amount = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
const forProperty = (records, propertyId) => records.filter((record) =>
  propertyId != null && String(read(record, 'propertyId')) === String(propertyId));

const rentCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', trailingZeroDisplay: 'stripIfInteger' });
const rentPeriods = new Map([
  ['daily', 'day'], ['weekly', 'wk'], ['biweekly', '2 wks'], ['semimonthly', 'half-month'],
  ['monthly', 'mo'], ['quarterly', 'qtr'], ['semiannually', '6 mos'], ['yearly', 'yr'], ['annually', 'yr']
]);
const weeklyCycleDays = new Map([['weekly', 7], ['biweekly', 14], ['bi-weekly', 14], ['fortnightly', 14]]);

export function formatLeasedRent(units) {
  const totals = new Map();
  for (const unit of units) {
    const lease = getRentLease(unit);
    if (!lease) continue;
    const rent = amount(read(lease, 'rentAmount') ?? read(unit, 'rentAmount'));
    if (!rent) continue;
    const frequency = String(read(lease, 'rentFrequency') ?? '').trim().toLowerCase() || 'monthly';
    const period = rentPeriods.get(frequency.replace(/[\s-]+/g, '')) ?? frequency;
    totals.set(period, (totals.get(period) ?? 0) + rent);
  }

  return [...totals].map(([period, rent]) => `${rentCurrency.format(rent)}/${period}`).join(' + ') || '—';
}

export function getRentLease(unit) {
  const lease = read(unit, 'lease');
  return read(lease, 'isActive') === false ? undefined : lease;
}

// Weekly and yearly billing periods start on the lease date, matching the rent balance.
// Undefined leaves other schedules to their existing date calculation.
export function getNextBillingDueDate(lease, today = new Date()) {
  const frequency = String(read(lease, 'rentFrequency') ?? '').trim().toLowerCase();
  const daysPerCycle = weeklyCycleDays.get(frequency);
  const yearly = frequency === 'yearly' || frequency === 'annually';
  if (!daysPerCycle && !yearly) return undefined;

  const start = new Date(`${String(read(lease, 'startDate') ?? '').slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;

  const currentDate = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  let dueDate = start;
  if (currentDate > start.getTime() && daysPerCycle) {
    const cycleMilliseconds = daysPerCycle * 86400000;
    const cycles = Math.ceil((currentDate - start.getTime()) / cycleMilliseconds);
    dueDate = new Date(start.getTime() + cycles * cycleMilliseconds);
  } else if (currentDate > start.getTime()) {
    const anniversary = (year) => {
      const month = start.getUTCMonth();
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      return new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay)));
    };
    dueDate = anniversary(today.getFullYear());
    if (dueDate.getTime() < currentDate) dueDate = anniversary(today.getFullYear() + 1);
  }

  const due = dueDate.toISOString().slice(0, 10);
  const end = String(read(lease, 'endDate') ?? '').slice(0, 10);
  return end && due > end ? null : due;
}

export function getPropertyBillingRentDue(records, propertyId) {
  const balances = forProperty(records, propertyId)
    .map((record) => read(record, 'currentBillingPeriodRentDue'))
    .filter((balance) => typeof balance === 'number' && Number.isFinite(balance));
  return balances.length ? balances.reduce((sum, balance) => sum + balance, 0) : null;
}

export function getPropertyBillingDueByLease(records, propertyId) {
  const dueByLease = new Map();
  for (const record of forProperty(records, propertyId)) {
    const leaseId = read(record, 'leaseId');
    const period = read(record, 'currentBillingPeriod');
    if (leaseId == null || !period) continue;
    if (Object.hasOwn(period, 'nextUnpaidDueDate') || Object.hasOwn(period, 'NextUnpaidDueDate')) {
      dueByLease.set(String(leaseId), {
        date: read(period, 'nextUnpaidDueDate') ?? null,
        paidInFull: read(period, 'paidInFull') === true
      });
    }
  }
  return dueByLease;
}

export function getPropertyBillingProgress(records, propertyId) {
  const periods = forProperty(records, propertyId).map((record) => read(record, 'currentBillingPeriod')).filter(Boolean);
  const names = new Set(periods.map((period) => read(period, 'period')));
  if (!periods.length || (names.size === 1 && names.has('month'))) return null;

  const expected = periods.reduce((sum, period) => sum + amount(read(period, 'expected')), 0);
  const collected = periods.reduce((sum, period) => sum + amount(read(period, 'collected')), 0);
  return {
    period: names.size === 1 ? [...names][0] : 'billing period',
    expected,
    collected,
    remaining: Math.max(0, expected - collected),
    percent: expected > 0 ? Math.min(100, (collected / expected) * 100) : 0
  };
}

// Use period-allocated rent credits, never payment dates or balances that include arrears/fees.
export function propertyHeaderMetrics(records = [], propertyId) {
  const scoped = forProperty(records, propertyId);
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
