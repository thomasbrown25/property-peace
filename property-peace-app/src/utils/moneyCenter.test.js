import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMoneyCenterQuery,
  getPeriodRange,
  normalizeMoneyCenterOverview,
  normalizeMoneyCenterItemsResponse,
  filterMoneyCenterItems,
  moneyCenterScopeToSearch,
  formatMoneyCenterDate
} from './moneyCenter.js';

test('period presets produce half-open UTC boundaries', () => {
  const now = new Date('2026-08-09T18:30:00-04:00');
  assert.deepEqual(getPeriodRange('this-month', now), {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-08-09T22:30:00.000Z'
  });
  assert.deepEqual(getPeriodRange('last-month', now), {
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-08-01T00:00:00.000Z'
  });
  assert.deepEqual(getPeriodRange('ytd', now), {
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-08-09T22:30:00.000Z'
  });
  assert.deepEqual(getPeriodRange('last-year', now), {
    from: '2025-01-01T00:00:00.000Z',
    to: '2026-01-01T00:00:00.000Z'
  });
});

test('custom local dates become a half-open UTC request and scope IDs stay numeric', () => {
  assert.deepEqual(buildMoneyCenterQuery(new URLSearchParams('period=custom&from=2026-08-03&to=2026-08-09&propertyId=12&unitId=44'), new Date('2026-08-09T00:00:00Z')), {
    from: '2026-08-03T00:00:00.000Z',
    to: '2026-08-10T00:00:00.000Z',
    propertyId: 12,
    unitId: 44,
    upcomingDays: 30
  });
});

test('invalid custom range safely falls back to this month', () => {
  const query = buildMoneyCenterQuery(new URLSearchParams('period=custom&from=bad&to=2026-08-01'), new Date('2026-08-09T00:00:00Z'));
  assert.equal(query.from, '2026-08-01T00:00:00.000Z');
  assert.equal(query.to, '2026-08-09T00:00:00.000Z');
  assert.equal(query.propertyId, undefined);
});

test('current-period range remains valid at the exact month boundary', () => {
  const range = getPeriodRange('this-month', new Date('2026-08-01T00:00:00.000Z'));
  assert.equal(range.from, '2026-08-01T00:00:00.000Z');
  assert.equal(range.to, '2026-08-01T00:00:00.001Z');
});

test('date rendering never throws for missing or invalid API dates', () => {
  assert.equal(formatMoneyCenterDate(undefined), 'Date unavailable');
  assert.equal(formatMoneyCenterDate('not-a-date'), 'Date unavailable');
  assert.equal(formatMoneyCenterDate('2026-08-09T12:00:00Z'), 'Aug 9, 2026');
});

test('camelCase overview is normalized without manufacturing values', () => {
  assert.equal(normalizeMoneyCenterOverview(null).isPartial, true);
  const normalized = normalizeMoneyCenterOverview({
    from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z', cameIn: 2400,
    dueNow: 600, wentOut: 900, recordedNetCashFlow: 1500,
    cameInDetail: { amount: 2400, count: 2 }, properties: null, categories: undefined,
    attention: { uncategorizedCount: 1 }, recentItems: null, dataQuality: { warnings: ['Partial records'] }
  });
  assert.equal(normalized.cameIn, 2400);
  assert.equal(normalized.recordedNetCashFlow, 1500);
  assert.deepEqual(normalized.properties, []);
  assert.deepEqual(normalized.categories, []);
  assert.deepEqual(normalized.recentItems, []);
  assert.equal(normalized.attention.uncategorizedCount, 1);
  assert.equal(normalized.attention.missingReceiptCount, 0);
  assert.deepEqual(normalized.dataQuality.warnings, ['Partial records']);
  assert.equal(normalized.isPartial, true);
  assert.equal(normalized.fieldAvailability.cameIn, true);
  assert.equal(normalized.fieldAvailability.projectedAfterUpcoming, false);
  assert.equal(normalized.sectionAvailability.properties, false);
  assert.equal(normalized.attentionAvailability.uncategorizedCount, true);
  assert.equal(normalized.attentionAvailability.missingReceiptCount, false);
});

test('nested cash-flow values retain availability instead of presenting missing values as zero', () => {
  const normalized = normalizeMoneyCenterOverview({
    cameIn: 1, dueNow: 2, wentOut: 3, recordedNetCashFlow: -2, upcomingObligations: 4, projectedAfterUpcoming: -6,
    cameInDetail: { amount: 1, count: 1 }, dueNowDetail: { amount: 2, count: 1 },
    wentOutDetail: { amount: 3, count: 1 }, upcomingDetail: { amount: 4, count: 1 },
    properties: [{ propertyId: 1, cameIn: 10, wentOut: null, recordedNetCashFlow: null, units: [{ unitId: 2, cameIn: null, wentOut: 5, recordedNetCashFlow: null }] }],
    categories: [{ category: 'Repairs', cameIn: null, wentOut: 5, count: null }], recentItems: [], explanations: [], taxPreparationChecklist: [],
    attention: { uncategorizedCount: 0, missingReceiptCount: 0, overdueObligationCount: 0, settlementCount: 0 }, dataQuality: { warnings: [] }
  });
  assert.deepEqual(normalized.properties[0].fieldAvailability, { cameIn: true, wentOut: false, recordedNetCashFlow: false });
  assert.deepEqual(normalized.properties[0].units[0].fieldAvailability, { cameIn: false, wentOut: true, recordedNetCashFlow: false });
  assert.deepEqual(normalized.categories[0].fieldAvailability, { cameIn: false, wentOut: true, count: false });
  assert.equal(normalized.isPartial, true);
});

test('partial item responses remain renderable and disclose missing contract fields', () => {
  const malformed = normalizeMoneyCenterItemsResponse({ items: null, totalCount: null });
  assert.deepEqual(malformed.items, []);
  assert.equal(malformed.totalCount, 0);
  assert.equal(malformed.isPartial, true);

  const complete = normalizeMoneyCenterItemsResponse({ items: [{ sourceId: 'payment:1' }], totalCount: 1, disclosures: [] });
  assert.equal(complete.totalCount, 1);
  assert.equal(complete.isPartial, false);

  const inconsistent = normalizeMoneyCenterItemsResponse({ items: [{ sourceId: 'payment:1' }, { sourceId: 'payment:2' }], totalCount: 1, disclosures: [] });
  assert.equal(inconsistent.totalCount, 2);
  assert.equal(inconsistent.isPartial, true);
});

test('drilldown filters select only exact real API items', () => {
  const items = [
    { sourceId: 'payment:1', sourceType: 'payment', direction: 'cameIn', propertyId: 1, unitId: 2, category: 'Rent', needsAttention: false, hasReceipt: true },
    { sourceId: 'expense:2', sourceType: 'expense', direction: 'wentOut', propertyId: 1, unitId: null, category: 'Uncategorized', needsAttention: false, hasReceipt: false },
    { sourceId: 'expense:3', sourceType: 'expense', direction: 'obligation', propertyId: 2, unitId: 3, category: 'Repairs', needsAttention: true, hasReceipt: false }
  ];
  assert.deepEqual(filterMoneyCenterItems(items, { direction: 'cameIn' }).map((x) => x.sourceId), ['payment:1']);
  assert.deepEqual(filterMoneyCenterItems(items, { category: 'uncategorized' }).map((x) => x.sourceId), ['expense:2']);
  assert.deepEqual(filterMoneyCenterItems(items, { attention: 'missingReceipt' }).map((x) => x.sourceId), ['expense:2']);
  assert.deepEqual(filterMoneyCenterItems(items, { attention: 'overdue' }).map((x) => x.sourceId), ['expense:3']);
  assert.deepEqual(filterMoneyCenterItems([{ ...items[0], needsAttention: true }, items[2]], { attention: 'settlement' }).map((x) => x.sourceId), ['payment:1']);
  assert.deepEqual(filterMoneyCenterItems(items, { propertyId: 1, unitId: 2 }).map((x) => x.sourceId), ['payment:1']);
});

test('URL scope serialization clears incompatible unit selection', () => {
  const next = moneyCenterScopeToSearch(new URLSearchParams('period=ytd&propertyId=1&unitId=2'), { propertyId: 3 });
  assert.equal(next.toString(), 'period=ytd&propertyId=3');
});

test('item normalization marks the fixed-limit response truncated when total exceeds loaded rows', () => {
  const truncated = normalizeMoneyCenterItemsResponse({
    items: [{ sourceId: 'payment:1' }],
    totalCount: 2,
    disclosures: []
  });
  assert.equal(truncated.loadedCount, 1);
  assert.equal(truncated.totalCount, 2);
  assert.equal(truncated.isTruncated, true);
  assert.equal(truncated.isPartial, true);
  assert.equal(
    normalizeMoneyCenterItemsResponse({ items: [{ sourceId: 'payment:1' }], totalCount: 1, disclosures: [] }).isTruncated,
    false
  );
});
