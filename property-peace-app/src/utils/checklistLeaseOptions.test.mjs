import assert from 'node:assert/strict';
import test from 'node:test';
import { getLeaseOptions, findLinkedChecklist, suggestLeaseId, leaseDates } from './checklistLeaseOptions.mjs';

const today = new Date('2026-10-10T12:00:00');
const leases = [
  { id: 1, unitId: 7, startDate: '2025-01-01', endDate: '2026-12-31', isActive: true },
  { id: 2, unitId: 7, startDate: '2027-01-01', endDate: '2028-01-01', isActive: true },
  { id: 3, unitId: 7, startDate: '2024-01-01', endDate: '2025-01-01', isActive: false },
  { id: 4, unitId: 8, startDate: '2024-02-01', endDate: '2025-02-01', isActive: false },
  { id: 5, unitId: 7, startDate: '2026-11-01', endDate: '2027-11-01', isActive: true, isDrafted: true }
];
const checklists = [{ id: 31, leaseId: 1, checklistType: 40, propertyId: 6, unitId: 7 }];

test('options include current, future and ended non-draft leases for the selected unit only', () => {
  assert.deepEqual(getLeaseOptions(leases, 7, today).map(({ lease, status }) => [lease.id, status]), [[1, 'Active'], [2, 'Upcoming'], [3, 'Recent']]);
});

test('move-in prefers unlinked active then upcoming; move-out prefers active then most recent', () => {
  const options = getLeaseOptions(leases, 7, today);
  assert.equal(suggestLeaseId(options, checklists, 'move-in'), 2);
  assert.equal(suggestLeaseId(options, checklists, 'move-out'), 1);
  assert.equal(suggestLeaseId(options.filter((option) => option.status !== 'Active'), [], 'move-in'), 2);
  assert.equal(suggestLeaseId(options.filter((option) => option.status !== 'Active'), [], 'move-out'), 3);
});

test('does not suggest leases with a linked checklist of the same type, but allows the other type', () => {
  const options = getLeaseOptions(leases, 7, today);
  assert.equal(suggestLeaseId(options, [{ ...checklists[0], leaseId: 1 }, { ...checklists[0], leaseId: 2 }], 'move-in'), null);
  assert.equal(findLinkedChecklist(checklists, 1, 'move-in').id, 31);
  assert.equal(findLinkedChecklist(checklists, 1, 'move-out'), null);
  assert.equal(suggestLeaseId(options, options.map(({ lease }) => ({ leaseId: lease.id, checklistType: 40 })), 'move-in'), null);
});

test('single-property lease selection is not filtered by absent unit; dates are concise', () => {
  assert.equal(getLeaseOptions(leases, null, today).length, 4);
  assert.match(leaseDates(leases[0]), /2025.*2026/);
});
