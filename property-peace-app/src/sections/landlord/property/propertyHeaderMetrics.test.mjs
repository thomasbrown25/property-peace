import test from 'node:test';
import assert from 'node:assert/strict';
import { propertyHeaderMetrics } from './propertyHeaderMetrics.mjs';

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
