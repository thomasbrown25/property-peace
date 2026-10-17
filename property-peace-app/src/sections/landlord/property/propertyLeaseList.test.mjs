import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recentPropertyLeases } from './propertyLeaseList.mjs';

test('property leases are newest first and limited to ten, including historical leases', () => {
  const leases = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    createdAt: `2025-01-${String(index + 1).padStart(2, '0')}`,
    isActive: index > 7
  })).reverse();
  const sorted = recentPropertyLeases(leases);
  assert.equal(sorted.length, 10);
  assert.deepEqual(sorted.map(({ id }) => id), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  assert.equal(leases.length, 12);
});

test('fallback to start date, then id; discard placeholders and deleted leases', () => {
  assert.deepEqual(recentPropertyLeases([
    { Id: 4, StartDate: '2024-02-01' },
    { id: 2, startDate: '2024-01-01' },
    { id: 3, startDate: '2024-02-01' },
    { id: 0 },
    { id: 9, isDeleted: true }
  ]).map((lease) => lease.id ?? lease.Id), [4, 3, 2]);
});
