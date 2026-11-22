import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLeasedRent, getNextBillingDueDate, getPropertyBillingDueByLease, getPropertyBillingProgress, getPropertyBillingRentDue, propertyHeaderMetrics } from './propertyHeaderMetrics.mjs';

test('unpaid dates are scoped to the property and distinguish a paid lease from missing data', () => {
  const records = [
    { propertyId: 7, leaseId: 1, currentBillingPeriod: { nextUnpaidDueDate: '2026-11-29' } },
    { PropertyId: 7, LeaseId: 2, CurrentBillingPeriod: { NextUnpaidDueDate: null, PaidInFull: true } },
    { propertyId: 7, leaseId: 3, currentBillingPeriod: {} },
    { propertyId: 9, leaseId: 4, currentBillingPeriod: { nextUnpaidDueDate: '2026-12-06' } },
    { propertyId: 7, leaseId: 5, currentBillingPeriod: { nextUnpaidDueDate: null, paidInFull: false } }
  ];
  assert.deepEqual([...getPropertyBillingDueByLease(records, 7)], [
    ['1', { date: '2026-11-29', paidInFull: false }],
    ['2', { date: null, paidInFull: true }],
    ['5', { date: null, paidInFull: false }]
  ]);
});

test('weekly due dates recur from the lease start and stop at the lease end', () => {
  const lease = { StartDate: '2026-10-28T00:00:00Z', EndDate: '2026-11-10', RentFrequency: 'Weekly' };
  assert.equal(getNextBillingDueDate(lease, new Date(2026, 9, 20)), '2026-10-28');
  assert.equal(getNextBillingDueDate(lease, new Date(2026, 10, 1)), '2026-11-04');
  assert.equal(getNextBillingDueDate(lease, new Date(2026, 10, 4)), '2026-11-04');
  assert.equal(getNextBillingDueDate(lease, new Date(2026, 10, 5)), null);
});

test('yearly due dates follow the lease anniversary and clamp leap-day starts', () => {
  const lease = { startDate: '2024-02-29', endDate: '2028-02-29', rentFrequency: 'Annually', rentDueDay: 1 };
  assert.equal(getNextBillingDueDate(lease, new Date(2025, 1, 27)), '2025-02-28');
  assert.equal(getNextBillingDueDate(lease, new Date(2027, 2, 1)), '2028-02-29');
  assert.equal(getNextBillingDueDate(lease, new Date(2028, 2, 1)), null);
  assert.equal(getNextBillingDueDate({ ...lease, rentFrequency: 'Monthly' }, new Date(2025, 1, 27)), undefined);
});

test('billing-period balances are scoped to the property and independent of monthly progress', () => {
  const records = [
    { propertyId: 7, currentBillingPeriodRentDue: 0, currentMonthExpected: 1200, currentMonthCollected: 300,
      currentBillingPeriod: { period: 'week', expected: 300, collected: 300 } },
    { propertyId: 8, currentBillingPeriodRentDue: 100 }
  ];
  assert.equal(getPropertyBillingRentDue(records, 7), 0);
  assert.equal(getPropertyBillingRentDue(records, 9), null);
  assert.equal(getPropertyBillingRentDue([...records, { PropertyId: 7, CurrentBillingPeriodRentDue: 200 }], 7), 200);
  assert.deepEqual(getPropertyBillingProgress(records, 7), { period: 'week', expected: 300, collected: 300, remaining: 0, percent: 100 });
  assert.equal(getPropertyBillingProgress(records, 8), null);
  const yearly = { PropertyId: 7, CurrentBillingPeriod: { Period: 'year', Expected: 12000, Collected: 6000 } };
  assert.deepEqual(getPropertyBillingProgress([yearly], 7), { period: 'year', expected: 12000, collected: 6000, remaining: 6000, percent: 50 });
  assert.equal(getPropertyBillingProgress([...records, yearly], 7).period, 'billing period');
});

test('leased rent uses the lease frequency and combines only matching billing periods', () => {
  assert.equal(formatLeasedRent([{ lease: { rentAmount: 1200 } }]), '$1,200/mo');
  assert.equal(formatLeasedRent([
    { Lease: { RentAmount: 200.5, RentFrequency: 'Weekly' } },
    { lease: { rentAmount: 50, rentFrequency: 'weekly' } },
    { lease: { rentAmount: 7200, rentFrequency: 'Yearly' } },
    { lease: { rentAmount: 900, rentFrequency: 'Monthly', isActive: false } },
    { rentAmount: 1000 }
  ]), '$250.50/wk + $7,200/yr');
  assert.equal(formatLeasedRent([{ rentAmount: 1000 }]), '—');
});

test('scopes current-month allocations to this property, excluding arrears and fees', () => {
  const result = propertyHeaderMetrics(
    [
      { propertyId: 7, currentMonthExpected: 1000, currentMonthCollected: 400, overdueAmount: 200, priorPeriodOverdueRent: 200, rentAmount: 2000, amountDueNow: 9999 },
      { PropertyId: '7', CurrentMonthExpected: 500, CurrentMonthCollected: 500, OverdueAmount: 100, PriorPeriodOverdueRent: 100, RentAmount: 500 },
      { propertyId: 8, currentMonthExpected: 9000, currentMonthCollected: 9000 }
    ],
    '7'
  );
  assert.deepEqual(result, { expected: 1500, collected: 900, remaining: 600, dueAmount: 900, percent: 60, overduePercent: -20, scheduledRent: 2500, pastDue: 300 });
});

test('caps collected per lease so overpayment cannot cover another unit', () => {
  const result = propertyHeaderMetrics(
    [
      { propertyId: 7, currentMonthExpected: 100, currentMonthCollected: 300 },
      { propertyId: 7, currentMonthExpected: 100, currentMonthCollected: 0 }
    ],
    7
  );
  assert.equal(result.collected, 100);
  assert.equal(result.percent, 50);
});

test('due amount includes prior arrears and unpaid current month without double-counting current overdue rent', () => {
  const result = propertyHeaderMetrics(
    [{ propertyId: 7, currentMonthExpected: 1000, currentMonthCollected: 250, priorPeriodOverdueRent: 300, overdueAmount: 1050 }],
    7
  );
  assert.equal(result.remaining, 750);
  assert.equal(result.dueAmount, 1050);
});

test('overdue progress is proportional to normal rent and capped at negative 100 percent', () => {
  assert.equal(propertyHeaderMetrics([{ propertyId: 7, currentMonthExpected: 1000, overdueAmount: 250 }], 7).overduePercent, -25);
  assert.equal(propertyHeaderMetrics([{ propertyId: 7, currentMonthExpected: 1000, overdueAmount: 1500 }], 7).overduePercent, -100);
  assert.equal(propertyHeaderMetrics([{ propertyId: 7, rentAmount: 800, overdueAmount: 400 }], 7).overduePercent, -50);
  assert.equal(propertyHeaderMetrics([{ propertyId: 7, currentMonthExpected: 1000, currentMonthCollected: 500 }], 7).overduePercent, 0);
  assert.equal(propertyHeaderMetrics([{ propertyId: 7, overdueAmount: 300 }], 7).overduePercent, 0);
});

test('empty and malformed data do not imply full collection', () => {
  assert.equal(propertyHeaderMetrics([], 7).percent, 0);
  assert.equal(propertyHeaderMetrics([{ propertyId: 7, currentMonthExpected: 'invalid', currentMonthCollected: -20 }], 7).percent, 0);
  assert.equal(propertyHeaderMetrics([{ currentMonthExpected: 100 }], undefined).expected, 0);
});
