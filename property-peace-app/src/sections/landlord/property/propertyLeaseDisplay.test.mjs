import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { propertyLeaseDisplayName } from './propertyRecords.mjs';

const source = readFileSync(new URL('./PropertyRecordsTabs.jsx', import.meta.url), 'utf8');

test('property lease column uses the lease display name and searches it', () => {
  assert.match(source, /label: 'Lease', value: row => propertyLeaseDisplayName\(row, property\)/);
  assert.match(source, /searchFields=\{row => \[propertyLeaseDisplayName\(row, property\)/);
});

test('lease name takes precedence over nickname and identifier', () => {
  assert.equal(propertyLeaseDisplayName({ id: 42, name: '  2026 Smith lease  ', leaseNickname: 'Old label' }, { name: 'Oak' }), '2026 Smith lease');
  assert.equal(propertyLeaseDisplayName({ Id: 42, Name: 'Renewal' }, {}), 'Renewal');
});

test('unnamed lease uses nickname then property or unit, never its identifier', () => {
  assert.equal(propertyLeaseDisplayName({ id: 42, leaseNickname: '  Garden lease  ' }, {}), 'Garden lease');
  assert.equal(propertyLeaseDisplayName({ id: 42, unitName: '2B' }, { name: 'Oak' }), 'Oak · 2B');
  assert.equal(propertyLeaseDisplayName({ id: 42 }, { name: 'Oak' }), 'Oak');
  assert.equal(propertyLeaseDisplayName({ id: 42 }, {}), 'Lease');
});
