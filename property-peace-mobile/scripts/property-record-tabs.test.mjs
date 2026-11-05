import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { scopePropertyRows, scopePropertyEndpointRows } from '../src/features/properties/propertyRecordScope.ts';

const detail = readFileSync(new URL('../src/screens/landlord/PropertyDetailScreen.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/components/properties/PropertyRecordPanel.tsx', import.meta.url), 'utf8');
const tabs = ['Overview', 'Leases', 'Tenants', 'Maintenances', 'Listings', 'Applications', 'Occupancy', 'Finances', 'Documents'];

test('property detail exposes every web record tab and mounts its matching panel', () => {
  for (const tab of tabs) assert.match(detail, new RegExp(`\\['${tab.toLowerCase()}', '${tab}'\\]`));
  for (const tab of tabs.slice(1).filter(tab => tab !== 'Tenants')) assert.match(panel, new RegExp(`tab === '${tab.toLowerCase()}'`));
  assert.match(detail, /<PropertyRecordPanel key=/);
  assert.match(detail, /visibleTab === 'tenants'/);
});

test('global property records exclude other properties and unscoped records', () => {
  assert.deepEqual(scopePropertyRows([{ id: 1, propertyId: 7 }, { id: 2, PropertyId: '8' }, { id: 3 }, { id: 4, PropertyId: '7' }], '7').map(row => row.id), [1, 4]);
});

test('server property endpoint accepts missing ID but refuses conflicting ID', () => {
  assert.deepEqual(scopePropertyEndpointRows([{ id: 1 }, { id: 2, propertyId: '9' }, { id: 3, PropertyId: 7 }], '7').map(row => [row.id, row.propertyId]), [[1, '7'], [3, '7']]);
});
