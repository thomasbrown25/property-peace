import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRecentPropertyStorageKey,
  readRecentlyViewedPropertyIds,
  recordRecentlyViewedProperty,
  resolveRecentlyViewedProperties
} from './recentlyViewedProperties.js';

const browserStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
globalThis.localStorage = browserStorage;
globalThis.sessionStorage = browserStorage;
globalThis.window = { name: '', dispatchEvent: () => {} };

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    snapshot: () => Object.fromEntries(values)
  };
}

const user = { id: 42, currentOrganizationId: 7 };

test('recent property storage is scoped by organization and user', () => {
  assert.equal(getRecentPropertyStorageKey(user), 'propertyPeace:recent-properties:7:42');
  assert.notEqual(
    getRecentPropertyStorageKey(user),
    getRecentPropertyStorageKey({ id: 42, currentOrganizationId: 8 })
  );
});

test('recording views keeps newest unique ids in a bounded list', () => {
  const storage = createStorage();

  ['1', '2', '3', '4', '5', '6', '3'].forEach((id) => recordRecentlyViewedProperty(id, user, storage));

  assert.deepEqual(readRecentlyViewedPropertyIds(user, storage), ['3', '6', '5', '4', '2']);
});

test('invalid storage is treated as empty history', () => {
  const key = getRecentPropertyStorageKey(user);
  const storage = createStorage({ [key]: '{not-json' });

  assert.deepEqual(readRecentlyViewedPropertyIds(user, storage), []);
});

test('history ids resolve only to currently authorized property records and preserve recency', () => {
  const properties = [
    { id: 1, name: 'First' },
    { Id: 2, Name: 'Second' },
    { id: 3, name: 'Third' }
  ];

  assert.deepEqual(
    resolveRecentlyViewedProperties(['2', '99', '1', '3'], properties, 2).map((property) => property.id ?? property.Id),
    [2, 1]
  );
});

test('missing user or organization scope fails closed', () => {
  const storage = createStorage();

  assert.equal(getRecentPropertyStorageKey({ id: 42 }), null);
  assert.deepEqual(recordRecentlyViewedProperty(1, { currentOrganizationId: 7 }, storage), []);
  assert.deepEqual(storage.snapshot(), {});
});
