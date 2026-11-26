import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getOwnerProperties } from '../utils/ownerHome.js';
import { readPropertyVisitDates, recordRecentlyViewedProperty, sortPropertiesByLastVisit } from '../utils/recentlyViewedProperties.js';

const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
globalThis.localStorage = storage();
globalThis.sessionStorage = storage();
globalThis.window = { name: '', dispatchEvent: () => {} };

const user = { id: 42, currentOrganizationId: 7 };
const properties = [
  { id: 1, name: 'Alpha' },
  { Id: 2, Name: 'Bravo' },
  { id: 3, name: 'Charlie' },
  { id: 4, name: 'Delta' },
  { id: 5, name: 'Echo' },
  { id: 6, name: 'Foxtrot' },
  { id: 7, name: 'Golf' },
  { id: 8, name: 'Hotel' },
  { id: 9, name: 'India' }
];
const visibleIds = (store, account = user) => sortPropertiesByLastVisit(
  getOwnerProperties(properties), readPropertyVisitDates(account, store)
).slice(0, 8).map((property) => property.id);

test('dashboard sorts all properties, including those without leases, before limiting the table to eight rows', () => {
  const store = storage();
  recordRecentlyViewedProperty(9, user, store, 1000);
  recordRecentlyViewedProperty(3, user, store, 2000);
  assert.deepEqual(visibleIds(store), [3, 9, 1, 2, 4, 5, 6, 7]);
  recordRecentlyViewedProperty(9, user, store, 3000);
  assert.deepEqual(visibleIds(store), [9, 3, 1, 2, 4, 5, 6, 7]);
  assert.deepEqual(properties.map((property) => property.id ?? property.Id), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('dashboard falls back to alphabetical order and isolates account visit history', () => {
  const store = storage();
  recordRecentlyViewedProperty(5, user, store, 1000);
  const alphabetical = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(visibleIds(storage()), alphabetical);
  assert.deepEqual(visibleIds(store, { ...user, currentOrganizationId: 8 }), alphabetical);
  assert.deepEqual(visibleIds(store, { ...user, id: 99 }), alphabetical);
});

test('dashboard appends a full-width View more link only when there are more than eight properties', () => {
  const source = readFileSync(new URL('../sections/landlord/dashboard/OwnerTodayHome.jsx', import.meta.url), 'utf8');
  assert.match(source, /const propertyRowLimit = 8;/);
  assert.match(source, /places\.slice\(0, propertyRowLimit\)\.map/);
  assert.match(source, /\{places\.length > propertyRowLimit && \(\s*<Button component=\{RouterLink\} to="\/landlord\/properties" fullWidth[^\n]*>\s*View more/);
});

test('dashboard listens for same-tab and cross-tab visit changes and cleans up listeners', () => {
  const source = readFileSync(new URL('../sections/landlord/dashboard/OwnerTodayHome.jsx', import.meta.url), 'utf8');
  assert.match(source, /sortPropertiesByLastVisit\(getOwnerProperties\(properties\), visitDates\)/);
  assert.match(source, /visitState\.scope === visitScope/);
  assert.match(source, /\[user, visitScope\]/);
  for (const event of ['PROPERTY_VISITED_EVENT', "'storage'"]) {
    assert.ok(source.includes(`window.addEventListener(${event}, refreshVisits)`));
    assert.ok(source.includes(`window.removeEventListener(${event}, refreshVisits)`));
  }
});
