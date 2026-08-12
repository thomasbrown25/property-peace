import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRentBalance } from './rentBalance.js';

test('normalizes canonical camelCase rent balance fields', () => {
  assert.deepEqual(
    normalizeRentBalance({
      rentDue: 1850,
      rentDueIsOverdue: true,
      currentMonthRentDue: 1500,
      overdueAmount: 350,
      amountDueNow: 1900
    }),
    {
      rentDue: 1850,
      rentDueIsOverdue: true,
      currentMonthRentDue: 1500,
      overdueAmount: 350
    }
  );
});

test('normalizes canonical PascalCase rent balance fields', () => {
  assert.deepEqual(
    normalizeRentBalance({
      RentDue: '925.50',
      RentDueIsOverdue: false,
      CurrentMonthRentDue: '925.50',
      OverdueAmount: 0
    }),
    {
      rentDue: 925.5,
      rentDueIsOverdue: false,
      currentMonthRentDue: 925.5,
      overdueAmount: 0
    }
  );
});

test('canonical rentDue wins over conflicting legacy arithmetic', () => {
  const result = normalizeRentBalance({
    rentDue: 400,
    rentDueIsOverdue: true,
    currentMonthRentDue: 0,
    overdueAmount: 400,
    rentAmount: 1200,
    amountDueNow: 1700
  });

  assert.equal(result.rentDue, 400);
  assert.equal(result.rentDueIsOverdue, true);
});

test('keeps the full canonical overdue bucket when prior-period overdue is smaller', () => {
  assert.deepEqual(
    normalizeRentBalance({
      rentDue: 1190,
      rentDueIsOverdue: true,
      currentMonthRentDue: 0,
      overdueAmount: 1190,
      priorPeriodOverdueRent: 0
    }),
    {
      rentDue: 1190,
      rentDueIsOverdue: true,
      currentMonthRentDue: 0,
      overdueAmount: 1190
    }
  );
});

test('falls back to the explicit current and overdue rent split', () => {
  assert.deepEqual(
    normalizeRentBalance({ currentMonthRentDue: 1200, priorPeriodOverdueRent: 275 }),
    {
      rentDue: 1475,
      rentDueIsOverdue: true,
      currentMonthRentDue: 1200,
      overdueAmount: 275
    }
  );
});

test('supports legacy collection records without treating unpaid fees as rent', () => {
  assert.deepEqual(
    normalizeRentBalance({ amountDueNow: 1775, overdueAmount: 275, unpaidFees: [{ amountDue: 75 }] }),
    {
      rentDue: 1700,
      rentDueIsOverdue: true,
      currentMonthRentDue: 1425,
      overdueAmount: 275
    }
  );
});

test('returns a safe zero balance for missing or invalid data', () => {
  assert.deepEqual(normalizeRentBalance(null), {
    rentDue: 0,
    rentDueIsOverdue: false,
    currentMonthRentDue: 0,
    overdueAmount: 0
  });
  assert.deepEqual(normalizeRentBalance({ rentDue: 'not-a-number', overdueAmount: -2 }), {
    rentDue: 0,
    rentDueIsOverdue: false,
    currentMonthRentDue: 0,
    overdueAmount: 0
  });
});
