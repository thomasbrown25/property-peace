import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCurrentMonthMoneySeries,
  normalizeRentCollectionMetrics,
  summarizeCurrentMonthRentIncome
} from './rentCollectionMetrics.js';

test('allocates collection progress from rent credited to the current period, not the payment date', () => {
  assert.deepEqual(
    normalizeRentCollectionMetrics({
      expectedThisMonth: 1200,
      collectedThisMonth: 0,
      remainingThisMonth: 0
    }),
    {
      expectedRent: 1200,
      income: 0,
      remainingRent: 1200,
      collectionPct: 0
    }
  );
});

test('falls back to collected-this-month arithmetic for older summaries without remaining balance', () => {
  assert.deepEqual(
    normalizeRentCollectionMetrics({ expectedThisMonth: 1200, collectedThisMonth: 300 }),
    {
      expectedRent: 1200,
      income: 300,
      remainingRent: 900,
      collectionPct: 25
    }
  );
});

test('clamps invalid and overpaid summary values to safe progress bounds', () => {
  assert.deepEqual(
    normalizeRentCollectionMetrics({ expectedThisMonth: 1200, collectedThisMonth: 1400, remainingThisMonth: -20 }),
    {
      expectedRent: 1200,
      income: 1400,
      remainingRent: 0,
      collectionPct: 100
    }
  );
});

test('uses finalized current-month rent payments when the rent summary has not refreshed yet', () => {
  const now = new Date(2026, 7, 27, 12);
  const payments = [
    { amount: 650, paymentDate: '2026-08-26T12:00:00', status: 'Completed' },
    { Amount: 350, PaymentDate: '2026-08-27T09:00:00', Status: 'Paid' },
    { amount: 90, paymentDate: '2026-08-27T09:00:00', status: 'Processing' },
    { amount: 75, paymentDate: '2026-08-27T09:00:00', status: 'Completed', feeId: 2 },
    { amount: 500, paymentDate: '2026-07-31T09:00:00', status: 'Completed' }
  ];

  assert.equal(summarizeCurrentMonthRentIncome(payments, now), 1000);
});

test('builds daily chart income from finalized rent payments with mixed API casing', () => {
  const now = new Date(2026, 7, 3, 12);
  const series = buildCurrentMonthMoneySeries({
    now,
    payments: [
      { amount: 600, paymentDate: '2026-08-02T10:00:00', status: 'Completed' },
      { Amount: 400, PaymentDate: '2026-08-02T15:00:00', Status: 'Paid' },
      { amount: 200, paymentDate: '2026-08-03T09:00:00', status: 'Failed' },
      { amount: 100, paymentDate: '2026-08-03T09:00:00', status: 'Completed', DepositId: 9 }
    ],
    expenses: [{ Amount: 20, PaidDate: '2026-08-03T11:00:00' }]
  });

  assert.deepEqual(series, [
    { label: 'Aug 01', income: 0, expenses: 0 },
    { label: 'Aug 02', income: 1000, expenses: 0 },
    { label: 'Aug 03', income: 0, expenses: 20 }
  ]);
});
