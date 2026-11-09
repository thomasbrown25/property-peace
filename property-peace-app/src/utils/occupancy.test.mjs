import test from 'node:test';
import assert from 'node:assert/strict';
import { isActiveOccupancyLease, getUnitActiveLease, isUnitOccupied, getPropertyOccupancy, isPropertyOccupied } from './occupancy.mjs';

const now = new Date('2026-11-08T12:00:00Z');
const active = { isActive: true, startDate: '2026-01-01', endDate: '2026-12-31' };
test('active lease establishes occupancy without tenants or saved status', () => {
  assert.equal(isUnitOccupied({ lease: active, isOccupied: false, status: 'vacant' }, now), true);
  assert.equal(isUnitOccupied({ isOccupied: true, status: 'overdue', tenants: [{}], leaseId: 42 }, now), false);
});
for (const [name, changes] of Object.entries({ inactive: { isActive: false }, deleted: { isDeleted: true }, draft: { isDrafted: true }, agreementDraft: { leaseAgreement: { isDrafted: true } }, future: { startDate: '2026-11-09' }, expired: { endDate: '2026-11-07' }, missingStart: { startDate: null }, invalidStart: { startDate: 'bad' }, invalidEnd: { endDate: 'bad' }, invalidDay: { startDate: '2026-02-30' } })) {
  test(`excludes ${name} lease`, () => assert.equal(isActiveOccupancyLease({ ...active, ...changes }, now), false));
}
test('start and end boundaries are inclusive calendar days', () => {
  assert.equal(isActiveOccupancyLease({ ...active, startDate: '2026-11-08T23:00:00Z', endDate: '2026-11-08T00:00:00Z' }, now), true);
});
test('open-ended and month-to-month use stored term dates, not auto-renew assumptions', () => {
  assert.equal(isActiveOccupancyLease({ ...active, endDate: null }, now), true);
  assert.equal(isActiveOccupancyLease({ ...active, endDate: '2026-11-07', leaseLength: -1, autoRenew: true }, now), false);
});
test('PascalCase and lease histories select a currently qualifying lease', () => {
  const lease = { IsActive: true, StartDate: '2026-01-01', LeaseAgreement: { IsDrafted: false } };
  assert.equal(isUnitOccupied({ Lease: lease }, now), true);
  assert.equal(isUnitOccupied({ Lease: { ...lease, LeaseAgreement: { IsDrafted: true } } }, now), false);
  assert.equal(getUnitActiveLease({ lease: { ...active, isActive: false }, Leases: [lease] }, now), lease);
});
test('counts each occupied unit once and ignores stale flags and deleted units', () => {
  const property = { isOccupied: false, Units: [
    { lease: active, leases: [active, active] },
    { isOccupied: true, status: 'occupied' },
    { lease: { ...active, isDrafted: true } },
    { lease: active, IsDeleted: true }
  ] };
  assert.deepEqual(getPropertyOccupancy(property, now), { totalUnits: 3, occupiedUnits: 1, vacantUnits: 2, occupancyRate: 33 });
  assert.equal(isPropertyOccupied(property, now), true);
  assert.equal(isPropertyOccupied({ isOccupied: true }, now), false);
  assert.deepEqual(getPropertyOccupancy(null, now), { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, occupancyRate: 0 });
});
