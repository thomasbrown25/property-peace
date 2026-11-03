import assert from 'node:assert/strict';
import test from 'node:test';
import { groupLandlordMoreNavigation } from './landlordMoreNavigation.js';

const item = (id) => ({ id, url: `/landlord/${id}` });
const groups = [
  { id: 'group-landlord-navigation', children: ['properties-page', 'leases', 'tenants'].map(item) },
  { id: 'group-property-operations', title: 'Property Operations', children: ['ai-center', 'inspections', 'maintenances', 'vendors'].map(item) },
  { id: 'group-accounting', children: [item('finances')] }
];

test('moves Properties, Leases and Tenants into Property Operations without duplicates or mutating shared navigation', () => {
  const original = structuredClone(groups);
  const result = groupLandlordMoreNavigation(groups);
  assert.deepEqual(result.map(({ id }) => id), ['group-property-operations', 'group-accounting']);
  assert.deepEqual(result[0].children.map(({ id }) => id), [
    'properties-page', 'leases', 'tenants', 'ai-center', 'inspections', 'maintenances', 'vendors'
  ]);
  assert.deepEqual(result[1], groups[2]);
  assert.deepEqual(groups, original);
});

test('preserves inventory filtering rather than restoring hidden lease and tenant links', () => {
  const filtered = groups.map((group) => ({
    ...group,
    children: group.children.filter(({ id }) => id !== 'leases' && id !== 'tenants')
  }));
  const result = groupLandlordMoreNavigation(filtered);
  assert.equal(result[0].children[0].id, 'properties-page');
  assert.equal(result.flatMap(({ children }) => children).some(({ id }) => id === 'leases' || id === 'tenants'), false);
});
