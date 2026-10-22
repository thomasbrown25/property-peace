import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileDashboardData } from './dashboardMobileSummary.js';

const example = {
  properties: [{ id: 11, name: 'Victoria' }, { Id: 12, Name: 'Arbors' }],
  requests: [{ propertyId: 11, status: 'Reported' }, { PropertyId: 11, Status: 'in_progress' }, { propertyId: 12, status: 'Completed' }],
  summary: { expectedThisMonth: 2700, collectedThisMonth: 1200, overdue: 1500 },
  rentRecords: [{ propertyId: 11, overdueAmount: 0 }, { PropertyId: 12, OverdueAmount: 1500 }],
  conversations: [{ unreadCount: 2 }, { UnreadCount: 9, IsArchived: true }]
};

test('mobile home derives repair, unread and rent totals from existing scoped responses', () => {
  const data = mobileDashboardData(example);
  assert.equal(data.openRepairs, 2);
  assert.equal(data.unread, 2);
  assert.equal(data.metrics.collectionPct.toFixed(0), '44');
  assert.deepEqual(data.rows.map(({ repairs, overdue }) => [repairs, overdue]), [[2, 0], [0, 1500]]);
  assert.equal(data.balancesAvailable, true);
});

test('invalid or inconsistent rent records never label property Paid', () => {
  const inconsistent = mobileDashboardData({ ...example, rentRecords: [{ propertyId: 11, overdueAmount: 0 }] });
  assert.equal(inconsistent.balancesAvailable, false);
  assert.equal(inconsistent.rows[0].overdue, null);
  assert.equal(mobileDashboardData({ ...example, rentRecords: [{ propertyId: 11, overdueAmount: NaN }] }).balancesAvailable, false);
});

test('settled prior balances remain zero and cents are preserved', () => {
  const data = mobileDashboardData({ ...example, summary: { overdue: 12.34 }, rentRecords: [{ PropertyId: 12, OverdueAmount: 12.34 }] });
  assert.equal(data.rows[1].overdue, 12.34);
  assert.equal(mobileDashboardData({ ...example, summary: { overdue: 0 }, rentRecords: [] }).rows[1].overdue, 0);
});
