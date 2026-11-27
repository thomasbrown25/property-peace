import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONLINE_PAYMENT_DISMISSAL_PATH,
  loadOnlinePaymentSetupDismissal,
  saveOnlinePaymentSetupDismissal
} from './onlinePaymentSetupDismissal.js';

const scope = JSON.stringify(['41', '7']);

test('loads a server dismissal with the selected organization header', async () => {
  const calls = [];
  const dismissed = await loadOnlinePaymentSetupDismissal({
    scope,
    organizationId: 7,
    signal: new AbortController().signal,
    get: async (path, config) => {
      calls.push({ path, config });
      return { data: { dismissed: true } };
    },
    put: async () => assert.fail('legacy sync should not run')
  });

  assert.equal(dismissed, true);
  assert.equal(calls[0].path, ONLINE_PAYMENT_DISMISSAL_PATH);
  assert.equal(calls[0].config.headers['X-Organization-Id'], '7');
});

test('rejects a malformed server dismissal response so the payment prompt cannot be shown from an unknown preference', async () => {
  await assert.rejects(
    loadOnlinePaymentSetupDismissal({
      scope,
      organizationId: 7,
      signal: new AbortController().signal,
      get: async () => ({ data: {} }),
      put: async () => assert.fail('legacy sync should not run')
    }),
    /response was invalid/
  );
});

test('migrates a legacy browser dismissal and clears it only after the server accepts it', async () => {
  const key = 'propertyPeace:owner-setup-todo:["41","7"]:online-payments';
  const items = new Map([[key, 'true']]);
  const storage = {
    getItem: (itemKey) => items.get(itemKey),
    removeItem: (itemKey) => items.delete(itemKey)
  };
  const calls = [];

  const dismissed = await loadOnlinePaymentSetupDismissal({
    scope,
    organizationId: 7,
    signal: new AbortController().signal,
    get: async () => assert.fail('server read should not run for a legacy dismissal'),
    put: async (path, body, config) => calls.push({ path, body, config }),
    storage
  });

  assert.equal(dismissed, true);
  assert.equal(items.has(key), false);
  assert.deepEqual(calls[0].body, undefined);
  assert.equal(calls[0].path, ONLINE_PAYMENT_DISMISSAL_PATH);
});

test('retains a legacy browser dismissal when its server migration fails', async () => {
  const key = 'propertyPeace:owner-setup-todo:["41","7"]:online-payments';
  const items = new Map([[key, 'true']]);
  const storage = {
    getItem: (itemKey) => items.get(itemKey),
    removeItem: (itemKey) => items.delete(itemKey)
  };

  await assert.rejects(
    loadOnlinePaymentSetupDismissal({
      scope,
      organizationId: 7,
      signal: new AbortController().signal,
      get: async () => assert.fail('server read should not run for a legacy dismissal'),
      put: async () => { throw new Error('network unavailable'); },
      storage
    }),
    /network unavailable/
  );
  assert.equal(items.get(key), 'true');
});

test('saves a new dismissal with the selected organization header', async () => {
  const calls = [];
  await saveOnlinePaymentSetupDismissal({
    organizationId: 7,
    signal: new AbortController().signal,
    put: async (path, body, config) => calls.push({ path, body, config })
  });

  assert.equal(calls[0].path, ONLINE_PAYMENT_DISMISSAL_PATH);
  assert.equal(calls[0].config.headers['X-Organization-Id'], '7');
});
