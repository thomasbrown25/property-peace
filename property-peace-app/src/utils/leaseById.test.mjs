import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leaseById } from './leaseById.mjs';

test('direct lease ID resolves scheduled and historical contracts without replacing the current projection', () => {
  const current = { id: 11, tenants: [{ id: 1 }] };
  const future = { id: 12, tenants: [{ id: 2 }], leaseAgreement: { id: 44 } };
  const properties = [{ name: 'Oak', units: [{ id: 7, lease: current, leases: [current, future] }] }];
  const result = leaseById(properties, '12');
  assert.equal(result.id, 12);
  assert.deepEqual(result.tenants, future.tenants);
  assert.deepEqual(result.leaseAgreement, future.leaseAgreement);
  assert.equal(result.propertyName, 'Oak');
  assert.equal(result.unit, properties[0].units[0]);
  assert.equal(properties[0].units[0].lease, current);
  assert.equal(leaseById(properties, '11').id, 11);
  assert.equal(leaseById(properties, '404'), undefined);
});

test('current contract retains its fully hydrated projection when collection row is minimal', () => {
  const current = { id: 11, leaseAgreement: { id: 44 }, tenants: [{ id: 1 }] };
  const result = leaseById([{ name: 'Oak', units: [{ lease: current, leases: [{ id: 11 }] }] }], '11');
  assert.deepEqual(result.leaseAgreement, current.leaseAgreement);
  assert.deepEqual(result.tenants, current.tenants);
});

test('legacy current lease remains reachable when collection is absent or incomplete', () => {
  assert.equal(leaseById([{ name: 'Oak', units: [{ lease: { id: 5 }, leases: [] }] }], '5')?.id, 5);
});

test('lease detail page uses by-ID resolution rather than only the current projection', () => {
  const page = readFileSync(new URL('../pages/landlord/lease.jsx', import.meta.url), 'utf8');
  assert.match(page, /leaseById\(properties, leaseId\)/);
});
