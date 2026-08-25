import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectUpcomingEntries } from './upcomingTab.js';

const sortedEntries = [
  {
    key: 'Recurring:1',
    type: 'Recurring',
    name: 'Oak insurance',
    category: 'Insurance',
    propertyName: 'Oak House',
    unitName: 'Property level',
    source: { id: 1, propertyId: 12, vendor: 'Harbor Mutual' }
  },
  {
    key: 'One-time:2',
    type: 'One-time',
    name: 'Boiler inspection',
    category: 'Maintenance',
    propertyName: 'Oak House',
    unitName: 'Unit 2',
    source: { Id: 2, PropertyId: 12, Vendor: 'Heat Safe' }
  },
  {
    key: 'Recurring:3',
    type: 'Recurring',
    name: 'Pine landscaping',
    category: 'Landscaping',
    propertyName: 'Pine House',
    unitName: 'Property level',
    source: { id: 3, propertyId: 13, vendor: 'Green Team' }
  },
  {
    key: 'One-time:4',
    type: 'One-time',
    name: 'Unscheduled repair',
    category: 'Repairs',
    propertyName: 'Property not recorded',
    unitName: 'Property level',
    source: { id: 4 }
  }
];

test('upcoming selection applies property, search, and type across the combined list without reordering it', () => {
  const originalKeys = sortedEntries.map((entry) => entry.key);

  assert.deepEqual(
    selectUpcomingEntries(sortedEntries, { propertyId: 12, search: 'oak', type: 'all' }).map((entry) => entry.key),
    ['Recurring:1', 'One-time:2']
  );
  assert.deepEqual(
    selectUpcomingEntries(sortedEntries, { propertyId: 12, search: 'heat safe', type: 'One-time' }).map((entry) => entry.key),
    ['One-time:2']
  );
  assert.deepEqual(sortedEntries.map((entry) => entry.key), originalKeys);
});

test('upcoming selection searches type and category and treats unsupported filters as All', () => {
  assert.deepEqual(selectUpcomingEntries(sortedEntries, { search: 'one-time', type: 'all' }).map((entry) => entry.key), ['One-time:2', 'One-time:4']);
  assert.deepEqual(selectUpcomingEntries(sortedEntries, { search: 'landscaping', type: 'Recurring' }).map((entry) => entry.key), ['Recurring:3']);
  assert.deepEqual(selectUpcomingEntries(sortedEntries, { propertyId: 'not-an-id', type: 'unexpected' }).map((entry) => entry.key), [
    'Recurring:1', 'One-time:2', 'Recurring:3', 'One-time:4'
  ]);
});
