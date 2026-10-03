import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduledPropertyLeases } from './scheduledPropertyLeases.mjs';

const property = { units: [
  { id: 7, name: 'A', isOccupied: true, lease: { id: 11, startDate: '2026-01-01', endDate: '2026-10-31', isActive: true } },
  { id: 8, name: 'B', isOccupied: false }
] };

test('current occupancy remains independent of scheduled successors, including same-day handoff', () => {
  const leases = [property.units[0].lease, { id: 12, unitId: 7, startDate: '2026-10-31T00:00:00Z', endDate: '2027-10-30', isActive: true }];
  const result = scheduledPropertyLeases(property, leases, '2026-10-31');
  assert.deepEqual(result.map((l) => l.id), [12]);
  assert.equal(property.units[0].lease.id, 11);
  assert.equal(property.units[0].isOccupied, true);
});

test('future active leases are shown for vacant units too, without turning them occupied', () => {
  const result = scheduledPropertyLeases(property, [{ Id: 14, UnitId: 8, StartDate: '2026-11-10', IsActive: true }], '2026-10-31');
  assert.equal(result[0].Id, 14);
  assert.equal(property.units[1].isOccupied, false);
});

test('drafts, deleted, foreign units, ended and invalid dates are not scheduled', () => {
  const leases = [
    { id: 20, unitId: 7, startDate: '2026-11-01', isDrafted: true },
    { id: 21, unitId: 7, startDate: '2026-11-01', isDeleted: true },
    { id: 22, unitId: 9, startDate: '2026-11-01', isActive: true },
    { id: 23, unitId: 7, startDate: '2026-09-01', isActive: false },
    { id: 24, unitId: 7, startDate: '2026-02-30', isActive: true }
  ];
  assert.deepEqual(scheduledPropertyLeases(property, leases, '2026-10-31'), []);
});

test('inactive stale current projection never makes a started lease look scheduled', () => {
  const stale = { units: [{ id: 7, lease: { id: 11, endDate: '2026-10-31', isActive: false } }] };
  assert.deepEqual(scheduledPropertyLeases(stale, [{ id: 12, unitId: 7, startDate: '2026-10-31', isActive: true }], '2026-10-31'), []);
});

test('after the outgoing lease ends, a started successor is not displayed as upcoming', () => {
  const leases = [{ id: 12, unitId: 7, startDate: '2026-10-31', isActive: true }];
  assert.deepEqual(scheduledPropertyLeases(property, leases, '2026-11-01'), []);
});
