import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDate, successorStartError, leaseTermError, incumbentLease } from './successorLease.mjs';

const occupied = { lease: { id: 7, isActive: true, endDate: '2026-10-31T00:00:00Z' } };
test('calendar dates compare without timezone or time-of-day drift', () => {
  assert.equal(calendarDate('2026-10-31T23:30:00-07:00'), '2026-10-31');
  assert.equal(calendarDate(new Date(2026, 9, 31)), '2026-10-31');
  assert.equal(calendarDate('2026-02-30'), null);
  assert.equal(calendarDate('nonsense'), null);
});
test('occupied unit allows same-day boundary and later, rejects earlier and missing end', () => {
  assert.equal(successorStartError('2026-10-31', occupied), null);
  assert.equal(successorStartError('2026-11-01', occupied), null);
  assert.match(successorStartError('2026-10-30', occupied), /2026-10-31/);
  assert.match(successorStartError('2026-11-01', { lease: { id: 7, isActive: true } }), /end date/i);
  assert.equal(successorStartError('2026-10-30', { lease: { isActive: false } }), null);
  assert.equal(incumbentLease(occupied)?.id, 7);
});
test('every finalized successor reserves its interval, including same-day boundaries', () => {
  const unit = { lease: occupied.lease, leases: [
    occupied.lease,
    { id: 8, isActive: true, startDate: '2026-11-10', endDate: '2027-11-10' },
    { id: 9, isActive: false, startDate: '2027-11-10', endDate: '2028-11-10' }
  ] };
  assert.match(leaseTermError('2026-11-01', '2026-11-11', unit), /2026-11-10/);
  assert.match(leaseTermError('2026-11-11', '2026-12-01', unit), /2026-11-10/);
  assert.equal(leaseTermError('2026-10-31', '2026-11-10', unit), null);
  assert.equal(leaseTermError('2027-11-10', '2028-11-10', unit), null);
  assert.match(leaseTermError('2026-11-09', '2026-11-11', unit), /2026-11-10/);
});

test('future bookings missing an end date prevent overlapping new terms', () => {
  const unit = { leases: [{ id: 8, isActive: true, startDate: '2026-11-10' }] };
  assert.match(leaseTermError('2026-11-11', '2027-01-01', unit), /2026-11-10/);
  assert.equal(leaseTermError('2026-11-01', '2026-11-10', unit), null);
});

test('invalid or reversed term is rejected; occupied unit requires explicit start even for draft', () => {
  assert.match(leaseTermError('2026-02-30', '2026-11-30'), /valid/i);
  assert.match(leaseTermError('2026-11-02', '2026-11-01'), /after/i);
  assert.match(leaseTermError('', '', occupied), /start date/i);
  assert.match(leaseTermError('2026-10-30', '2026-12-31', occupied), /2026-10-31/);
  assert.equal(leaseTermError('2026-10-31', '2027-10-31', occupied), null);
});
