import test from 'node:test';
import assert from 'node:assert/strict';

import { getOnlinePaymentsWelcomeStorageKey, hasContinuedToOnlinePayments, markOnlinePaymentsContinued } from './onlinePaymentsWelcome.js';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    snapshot() {
      return Object.fromEntries(values);
    }
  };
}

const user = { id: 42, currentOrganizationId: 7 };

test('online payment welcome storage is scoped to both organization and user', () => {
  assert.equal(getOnlinePaymentsWelcomeStorageKey(user), 'propertyPeace:online-payments-continued:7:42');
  assert.notEqual(getOnlinePaymentsWelcomeStorageKey(user), getOnlinePaymentsWelcomeStorageKey({ id: 42, currentOrganizationId: 8 }));
  assert.notEqual(getOnlinePaymentsWelcomeStorageKey(user), getOnlinePaymentsWelcomeStorageKey({ id: 43, currentOrganizationId: 7 }));
});

test('the active organization context is used when it is separate from the user payload', () => {
  assert.equal(getOnlinePaymentsWelcomeStorageKey({ id: 42 }, { id: 7 }), 'propertyPeace:online-payments-continued:7:42');
});

test('continuing once permanently selects the online payments workspace for that scope', () => {
  const storage = createStorage();

  assert.equal(hasContinuedToOnlinePayments(user, null, storage), false);
  assert.equal(markOnlinePaymentsContinued(user, null, storage), true);
  assert.equal(hasContinuedToOnlinePayments(user, null, storage), true);
});

test('welcome persistence fails closed when user or organization scope is unavailable', () => {
  const storage = createStorage();

  assert.equal(getOnlinePaymentsWelcomeStorageKey({ id: 42 }), null);
  assert.equal(markOnlinePaymentsContinued({ currentOrganizationId: 7 }, null, storage), false);
  assert.equal(hasContinuedToOnlinePayments({ id: 42 }, null, storage), false);
  assert.deepEqual(storage.snapshot(), {});
});
