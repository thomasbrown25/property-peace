import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as financesModel from './finances.js';
import {
  normalizeFinancesTab, updateFinancesSearch, buildFinancesMoneyQuery,
  buildActivityEntries, selectNeedsReviewItems, buildAccountActivity,
  buildUpcomingEntries, sumCollectedThisMonth, updateFinancesPropertyScope,
  buildActivityCsvRows, buildReviewCsvRows, getActivityAccountOptions,
  selectActivityEntriesPage, selectFinancesExportState,
  isFinancesPageLoading
} from './finances.js';

test('finances defaults to Activity and keeps shared scope when tabs change', () => {
  assert.equal(normalizeFinancesTab(null), 'activity');
  assert.equal(normalizeFinancesTab('nonsense'), 'activity');
  assert.equal(normalizeFinancesTab('expenses'), 'expenses');
  const next = updateFinancesSearch(new URLSearchParams('period=ytd&propertyId=12&unitId=3&tab=review'), { tab: 'payments', status: 'completed' });
  assert.equal(next.toString(), 'period=ytd&propertyId=12&unitId=3&tab=payments&status=completed');
});

test('finances uses year to date when URL period is absent or unsupported', () => {
  const expected = {
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-08-25T12:00:00.000Z',
    upcomingDays: 30
  };
  const now = new Date('2026-08-25T12:00:00Z');
  assert.deepEqual(buildFinancesMoneyQuery(new URLSearchParams(), now), expected);
  assert.deepEqual(buildFinancesMoneyQuery(new URLSearchParams('period=unsupported'), now), expected);
});

test('matching property hydration preserves the existing unit scope', () => {
  const current = new URLSearchParams('period=ytd&propertyId=12&unitId=3&tab=activity&account=Repairs');
  const next = updateFinancesPropertyScope(current, 12);
  assert.equal(next?.toString(), 'period=ytd&propertyId=12&unitId=3&tab=activity&account=Repairs');
});

test('changing or clearing property removes incompatible unit scope', () => {
  const current = new URLSearchParams('period=ytd&propertyId=12&unitId=3&tab=activity&account=Repairs');
  const changed = updateFinancesPropertyScope(current, 14);
  const cleared = updateFinancesPropertyScope(current, undefined);
  assert.equal(changed?.toString(), 'period=ytd&propertyId=14&tab=activity&account=Repairs');
  assert.equal(cleared?.toString(), 'period=ytd&tab=activity&account=Repairs');
});

test('Activity account selection and every clear path update the canonical URL state', () => {
  assert.equal(typeof financesModel.updateFinancesActivityAccount, 'function');
  const current = new URLSearchParams('period=ytd&propertyId=12&unitId=3&tab=activity');
  const selected = financesModel.updateFinancesActivityAccount(current, 'Repairs');
  const cleared = financesModel.updateFinancesActivityAccount(selected, 'all');

  assert.equal(selected.toString(), 'period=ytd&propertyId=12&unitId=3&tab=activity&account=Repairs');
  assert.equal(cleared.toString(), 'period=ytd&propertyId=12&unitId=3&tab=activity');
  assert.equal(financesModel.updateFinancesActivityAccount(selected, '').toString(), cleared.toString());
});

test('finances page loading covers every core data source and scope transition', () => {
  assert.equal(isFinancesPageLoading(), false);

  for (const loadingKey of [
    'propertiesLoading',
    'moneyLoading',
    'moneyScopeChanged',
    'paymentsLoading',
    'paymentsScopeChanged',
    'expensesLoading'
  ]) {
    assert.equal(isFinancesPageLoading({ [loadingKey]: true }), true, loadingKey);
  }
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

test('review selection treats malformed non-string categories as uncategorized input without throwing', () => {
  const result = selectNeedsReviewItems([
    { sourceId: 'numeric', sourceType: 'expense', direction: 'wentOut', category: 42, hasReceipt: true },
    { sourceId: 'object', sourceType: 'expense', direction: 'wentOut', category: { label: 'Other' }, hasReceipt: false }
  ]);

  assert.deepEqual(
    result.map((item) => item.sourceId),
    ['object']
  );
  assert.deepEqual(result[0].reviewReasons, ['Missing receipt']);
});

test('export registration is current only for the exact active tab and navigation key', () => {
  const registration = {
    tab: 'activity',
    registrationKey: 'navigation-b:activity',
    exportState: { label: 'Export activity', mode: 'visible-client-page' }
  };

  assert.deepEqual(
    selectFinancesExportState(registration, 'activity', 'navigation-b:activity'),
    { label: 'Export activity', mode: 'visible-client-page' }
  );
  assert.equal(selectFinancesExportState(null, 'activity', 'navigation-b:activity'), null);
  assert.equal(selectFinancesExportState(registration, 'review', 'navigation-b:activity'), null);
  assert.equal(selectFinancesExportState(registration, 'activity', 'navigation-c:activity'), null);
  assert.equal(selectFinancesExportState({ ...registration, exportState: null }, 'activity', 'navigation-b:activity'), null);
});
test('activity selection combines search, type, account, sort, and twelve-row pagination', () => {
  const entries = Array.from({ length: 14 }, (_, index) => ({
    sourceId: `expense-${index + 1}`,
    occurredAt: `2026-08-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
    timestamp: Date.parse(`2026-08-${String(index + 1).padStart(2, '0')}T12:00:00Z`),
    direction: 'wentOut',
    description: index === 13 ? 'Emergency roof repair' : `Repair ${index + 1}`,
    account: index === 13 ? 'Capital improvements' : 'Repairs',
    propertyName: 'Oak House',
    unitName: 'Unit 2',
    signedAmount: -(index + 1),
    runningBalance: 200 - index
  }));
  entries.push({
    sourceId: 'income-1', occurredAt: '2026-08-20T12:00:00Z', timestamp: Date.parse('2026-08-20T12:00:00Z'),
    direction: 'cameIn', description: 'August rent', account: 'Rent', propertyName: 'Pine House',
    unitName: 'Unit 1', counterparty: 'Avery Tenant', reference: 'R-100', signedAmount: 900, runningBalance: 1100
  });

  const firstPage = selectActivityEntriesPage(entries, { search: 'repair', type: 'expense', account: 'Repairs', sort: 'oldest', page: 1 });
  const clampedPage = selectActivityEntriesPage(entries, { search: 'oak', type: 'expense', account: 'all', sort: 'amount-desc', page: 99 });
  const referenceMatch = selectActivityEntriesPage(entries, { search: 'r-100', type: 'all', account: 'all', sort: 'newest', page: 1 });

  assert.equal(firstPage.totalCount, 13);
  assert.equal(firstPage.totalPages, 2);
  assert.equal(firstPage.page, 1);
  assert.equal(firstPage.visibleEntries.length, 12);
  assert.equal(firstPage.visibleEntries[0].sourceId, 'expense-1');
  assert.equal(firstPage.visibleEntries[11].sourceId, 'expense-12');
  assert.equal(clampedPage.page, 2);
  assert.deepEqual(clampedPage.visibleEntries.map((entry) => entry.sourceId), ['expense-2', 'expense-1']);
  assert.deepEqual(referenceMatch.visibleEntries.map((entry) => entry.sourceId), ['income-1']);
});

test('activity account options are unique, alphabetical, and derived from real entries', () => {
  assert.deepEqual(getActivityAccountOptions([
    { account: 'Repairs' }, { account: 'Rent' }, { account: 'repairs' }, { account: '' }, { account: 'Utilities' }
  ]), ['Rent', 'Repairs', 'Utilities']);
});

test('visible activity and review CSV rows retain truthful source fields', () => {
  const activityRows = buildActivityCsvRows([{
    sourceId: 'payment-4', occurredAt: '2026-08-05T00:00:00Z', direction: 'cameIn', description: 'August rent',
    propertyName: 'Oak House', unitName: 'Unit 2', account: 'Rent', signedAmount: 1200, runningBalance: 2200,
    sourceType: 'payment'
  }]);
  const reviewRows = buildReviewCsvRows([{
    sourceId: 'expense-9', occurredAt: '2026-08-06T00:00:00Z', reviewReasons: ['Uncategorized', 'Missing receipt'],
    description: 'Hardware store', propertyName: 'Pine House', unitName: '', category: 'Uncategorized', amount: 78.5,
    sourceType: 'expense'
  }]);

  assert.deepEqual(activityRows, [{
    'Source ID': 'payment-4', Date: '2026-08-05T00:00:00Z', Type: 'Income', Description: 'August rent',
    'Property / unit': 'Oak House / Unit 2', Account: 'Rent', Amount: 1200, 'Activity balance': 2200,
    'Source type': 'payment'
  }]);
  assert.deepEqual(reviewRows, [{
    'Source ID': 'expense-9', Date: '2026-08-06T00:00:00Z', Reasons: 'Uncategorized; Missing receipt',
    Description: 'Hardware store', 'Property / unit': 'Pine House / Property level', Category: 'Uncategorized',
    Amount: 78.5, 'Source type': 'expense'
  }]);
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

test('collected this month uses the same requested unit as editable payment rows', () => {
  const now = new Date('2026-08-25T12:00:00Z');
  const payments = [
    { Amount: 100, Status: 'Completed', PaidAt: '2026-08-05', PropertyId: 12, UnitId: 301 },
    { amount: 250, status: 'completed', paidAt: '2026-08-06', propertyId: 12, unitId: 302 }
  ];

  assert.equal(sumCollectedThisMonth(payments, now, 12, 302), 250);
});

test('truncated Money Center rows never produce authoritative running or account totals', () => {
  assert.equal(typeof financesModel.deriveFinancesMoneyItems, 'function');
  const items = [
    {
      sourceId: 'payment:1',
      sourceType: 'payment',
      direction: 'cameIn',
      amount: 100,
      occurredAt: '2026-08-01',
      category: 'Rent'
    },
    {
      sourceId: 'expense:2',
      sourceType: 'expense',
      direction: 'wentOut',
      amount: 25,
      occurredAt: '2026-08-02',
      category: 'Uncategorized',
      hasReceipt: false
    }
  ];
  const partial = financesModel.deriveFinancesMoneyItems({ items, totalCount: 3, isTruncated: true });
  assert.equal(partial.clientDerivationsAvailable, false);
  assert.deepEqual(
    partial.activityEntries.map((entry) => entry.runningBalance),
    [null, null]
  );
  assert.deepEqual(partial.accountActivity, []);
  assert.equal(partial.reviewItems.length, 1);

  const complete = financesModel.deriveFinancesMoneyItems({ items, totalCount: 2, isTruncated: false });
  assert.equal(complete.clientDerivationsAvailable, true);
  assert.equal(complete.activityEntries[0].runningBalance, 75);
  assert.equal(complete.accountActivity.length, 2);
});
