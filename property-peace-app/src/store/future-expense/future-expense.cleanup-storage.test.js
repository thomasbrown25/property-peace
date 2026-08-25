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

const marker = (futureExpenseId, propertyId, landlordId = 44) => ({
  futureExpenseId,
  propertyId,
  landlordId,
  cleanupError: 'Scheduled item could not be removed'
});

test('cleanup recovery survives a hard reload with only minimal marker metadata', () => {
  const storage = new MemoryStorage();
  const saved = { ...marker(9, 12), expenseId: 101, source: { id: 9, name: 'Roof inspection' } };

  assert.equal(upsertFutureExpenseCleanupMarker(storage, saved), true);
  const restored = readFutureExpenseCleanupMarkers(storage, 44);

  assert.deepEqual(restored, { '9': marker(9, 12) });
  const serialized = storage.getItem(cleanupStorageKey(44));
  assert.doesNotMatch(serialized, /Roof inspection|expenseId|source|name/);
});

test('cleanup storage is isolated by landlord and rejects mismatched ownership', () => {
  const storage = new MemoryStorage();
  upsertFutureExpenseCleanupMarker(storage, marker(9, 12, 44));
  upsertFutureExpenseCleanupMarker(storage, marker(10, 13, 55));

  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 44), { '9': marker(9, 12, 44) });
  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 55), { '10': marker(10, 13, 55) });
  assert.notEqual(cleanupStorageKey(44), cleanupStorageKey(55));

  storage.setItem(cleanupStorageKey(44), JSON.stringify({ landlordId: '55', markers: [marker(11, 12, 55)] }));
  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 44), {});
});

test('cleanup storage tolerates malformed and unavailable browser storage', () => {
  const malformed = new MemoryStorage();
  malformed.setItem(cleanupStorageKey(44), '{not json');
  assert.deepEqual(readFutureExpenseCleanupMarkers(malformed, 44), {});

  const unavailable = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  };
  assert.deepEqual(readFutureExpenseCleanupMarkers(unavailable, 44), {});
  assert.equal(writeFutureExpenseCleanupMarkers(unavailable, 44, { '9': marker(9, 12) }), false);
  assert.equal(removeFutureExpenseCleanupMarker(unavailable, 44, 9), false);
});

test('persisted cleanup recovery clears after authoritative reconciliation', () => {
  const storage = new MemoryStorage();
  upsertFutureExpenseCleanupMarker(storage, marker(9, 12));
  upsertFutureExpenseCleanupMarker(storage, marker(13, 13));

  assert.equal(removeFutureExpenseCleanupMarker(storage, 44, 9), true);
  assert.deepEqual(readFutureExpenseCleanupMarkers(storage, 44), { '13': marker(13, 13) });

  assert.equal(writeFutureExpenseCleanupMarkers(storage, 44, {}), true);
  assert.equal(storage.getItem(cleanupStorageKey(44)), null);
});
