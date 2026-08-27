import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanupStorageKey,
  readFutureExpenseCleanupMarkers,
  removeFutureExpenseCleanupMarker,
  upsertFutureExpenseCleanupMarker,
  writeFutureExpenseCleanupMarkers
} from './future-expense.cleanup-storage.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const marker = (futureExpenseId, propertyId, landlordId = 44, organizationId = 7) => ({
  futureExpenseId,
  propertyId,
  landlordId,
  organizationId,
  cleanupError: 'Scheduled item could not be removed'
});

test('cleanup recovery survives a hard reload with only minimal marker metadata', () => {
  const storage = new MemoryStorage();
  const saved = { ...marker(9, 12), expenseId: 101, source: { id: 9, name: 'Roof inspection' } };

  assert.equal(upsertFutureExpenseCleanupMarker(storage, saved), true);
  const restored = readFutureExpenseCleanupMarkers(storage, 44, 7);

  assert.deepEqual(restored, { '9': marker(9, 12) });
  const serialized = storage.getItem(cleanupStorageKey(44, 7));
  assert.doesNotMatch(serialized, /Roof inspection|expenseId|source|name/);
});

test('cleanup storage is isolated by landlord and organization even when future IDs collide', () => {
  const storage = new MemoryStorage();
  upsertFutureExpenseCleanupMarker(storage, marker(9, 12, 44, 7));
  upsertFutureExpenseCleanupMarker(storage, marker(9, 99, 44, 8));
  upsertFutureExpenseCleanupMarker(storage, marker(10, 13, 55, 7));

  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 44, 7), { '9': marker(9, 12, 44, 7) });
  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 44, 8), { 9: marker(9, 99, 44, 8) });
  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 55, 7), { '10': marker(10, 13, 55, 7) });
  assert.notEqual(cleanupStorageKey(44, 7), cleanupStorageKey(44, 8));
  assert.notEqual(cleanupStorageKey(44, 7), cleanupStorageKey(55, 7));

  storage.setItem(cleanupStorageKey(44, 7), JSON.stringify({ version: 2, landlordId: '44', organizationId: '8', markers: [marker(11, 12, 44, 8)] }));
  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 44, 7), {});
  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 44, 8), { 9: marker(9, 99, 44, 8) });
});

test('cleanup storage tolerates malformed and unavailable browser storage', () => {
  const malformed = new MemoryStorage();
  malformed.setItem(cleanupStorageKey(44, 7), '{not json');
  assert.deepEqual(readFutureExpenseCleanupMarkers(malformed, 44, 7), {});

  const unavailable = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  };
  assert.deepEqual(readFutureExpenseCleanupMarkers(unavailable, 44, 7), {});
  assert.equal(writeFutureExpenseCleanupMarkers(unavailable, 44, 7, { '9': marker(9, 12) }), false);
  assert.equal(removeFutureExpenseCleanupMarker(unavailable, 44, 7, 9), false);
});

test('persisted cleanup recovery clears after authoritative reconciliation', () => {
  const storage = new MemoryStorage();
  upsertFutureExpenseCleanupMarker(storage, marker(9, 12));
  upsertFutureExpenseCleanupMarker(storage, marker(13, 13));

  assert.equal(removeFutureExpenseCleanupMarker(storage, 44, 7, 9), true);
  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 44, 7), { '13': marker(13, 13) });

  assert.equal(writeFutureExpenseCleanupMarkers(storage, 44, 7, {}), true);
  assert.equal(storage.getItem(cleanupStorageKey(44, 7)), null);
});
test('legacy v1 cleanup entries are safely discarded instead of crossing organizations', () => {
  const storage = new MemoryStorage();
  const legacyKey = 'property-peace:future-expense-cleanup:v1:44';
  storage.setItem(legacyKey, JSON.stringify({ landlordId: '44', markers: [marker(9, 12)] }));

  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 44, 7), {});
  assert.equal(storage.getItem(legacyKey), null);
  assert.equal(storage.getItem(cleanupStorageKey(44, 7)), null);
});
