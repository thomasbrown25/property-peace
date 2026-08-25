import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeFinancesTab, updateFinancesSearch, buildFinancesMoneyQuery,
  buildActivityEntries, selectNeedsReviewItems, buildAccountActivity,
  buildUpcomingEntries, sumCollectedThisMonth
} from './finances.js';

test('finances defaults to Activity and keeps shared scope when tabs change', () => {
  assert.equal(normalizeFinancesTab(null), 'activity');
  assert.equal(normalizeFinancesTab('nonsense'), 'activity');
  assert.equal(normalizeFinancesTab('expenses'), 'expenses');
  const next = updateFinancesSearch(new URLSearchParams('period=ytd&propertyId=12&unitId=3&tab=review'), { tab: 'payments', status: 'completed' });
  assert.equal(next.toString(), 'period=ytd&propertyId=12&unitId=3&tab=payments&status=completed');
});

test('finances uses year to date when URL has no period', () => {
  assert.equal(buildFinancesMoneyQuery(new URLSearchParams(), new Date('2026-08-25T12:00:00Z')).from, '2026-01-01T00:00:00.000Z');
});

test('activity normalizes posted cash directions, excludes non-cash, and calculates newest-first running balance', () => {
  const items = [
    { sourceId: 'b', sourceType: 'expense', occurredAt: '2026-01-02T00:00:00Z', direction: 'wentOut', amount: 25, category: 'Repairs', propertyName: 'P' },
    { sourceId: 'a', sourceType: 'payment', occurredAt: '2026-01-01T00:00:00Z', direction: 'cameIn', amount: '100', description: 'Rent' },
    { sourceId: 'z', sourceType: 'expense', occurredAt: '2026-01-03T00:00:00Z', direction: 'obligation', amount: 40 },
    { sourceId: 'x', sourceType: 'expense', occurredAt: '2026-01-04T00:00:00Z', direction: 'excluded', amount: 5 },
    { sourceId: 'i', sourceType: 'expense', occurredAt: 'bad', direction: 'wentOut', amount: 'oops' }
  ];
  const result = buildActivityEntries(items);
  assert.deepEqual(result.map((entry) => entry.sourceId), ['b', 'a', 'i']);
  assert.deepEqual(result.slice(0, 2).map((entry) => entry.runningBalance), [75, 100]);
  assert.equal(result[2].timestamp, null);
  assert.equal(result[2].signedAmount, 0);
  assert.equal(result[0].description, 'Repairs');
});

test('review selection deduplicates reasons and covers all signals', () => {
  const items = [
    { sourceId: 'e', sourceType: 'expense', direction: 'wentOut', category: 'Uncategorized', hasReceipt: false },
    { sourceId: 'o', sourceType: 'expense', direction: 'obligation', needsAttention: true },
    { sourceId: 'p', sourceType: 'payment', direction: 'cameIn', needsAttention: true },
    { sourceId: 'n', sourceType: 'expense', direction: 'wentOut', category: 'Rent', hasReceipt: true }
  ];
  const result = selectNeedsReviewItems(items);
  assert.deepEqual(result.map((x) => x.sourceId), ['e', 'o', 'p']);
  assert.deepEqual(result[0].reviewReasons, ['Uncategorized', 'Missing receipt']);
  assert.deepEqual(result[1].reviewReasons, ['Overdue obligation']);
  assert.deepEqual(result[2].reviewReasons, ['Settlement exception']);
});

test('account activity groups signed totals and ranks by absolute total with alphabetical ties', () => {
  const result = buildAccountActivity([
    { account: 'Zed', signedAmount: -5 }, { account: 'Alpha', signedAmount: 5 }, { account: 'Zed', signedAmount: 2 }
  ]);
  assert.deepEqual(result, [
    { account: 'Alpha', signedTotal: 5, count: 1 },
    { account: 'Zed', signedTotal: -3, count: 2 }
  ]);
});

test('upcoming entries merge recurring and future entries and sort invalid dates last', () => {
  const result = buildUpcomingEntries([
    { id: 2, name: 'Later', category: 'Rent', propertyName: 'P', unitName: '1', amount: '20', nextOccurrenceDate: '2026-09-02', frequency: 'monthly', isPaused: true },
    { id: 1, name: 'Soon', amount: 10, nextOccurrenceDate: '2026-09-01' },
    { id: 3, name: 'Unknown', nextOccurrenceDate: 'bad' }
  ], [ { id: 4, name: 'One time', amount: 30, dueDate: '2026-09-01' } ]);
  assert.deepEqual(result.map((x) => x.key), ['Recurring:1', 'One-time:4', 'Recurring:2', 'Recurring:3']);
  assert.equal(result[1].type, 'One-time');
  assert.equal(result[1].source.id, 4);
  assert.equal(result[2].isPaused, true);
  assert.equal(result[3].actionDate, 'bad');
});

test('collected this month accepts status and casing aliases and scope', () => {
  const now = new Date('2026-08-25T12:00:00Z');
  const payments = [
    { Amount: '100', Status: 'Completed', PaidAt: '2026-08-05', PropertyId: 12 },
    { amount: 20, status: 'succeeded', paidAt: '2026-08-06', propertyId: 13 },
    { amount: 30, status: 'paid', paidAt: '2026-07-06', propertyId: 12 },
    { amount: 40, status: 'failed', paidAt: '2026-08-07', propertyId: 12 },
    { amount: 50, status: 'processing', paidAt: '2026-08-08', propertyId: 12 },
    { amount: 'nope', status: 'paid', paidAt: '2026-08-08', propertyId: 12 }
  ];
  assert.equal(sumCollectedThisMonth(payments, now, 12), 100);
  assert.equal(sumCollectedThisMonth(payments, now), 120);
});
