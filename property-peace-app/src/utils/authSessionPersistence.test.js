import assert from 'node:assert/strict';
import test from 'node:test';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear()
  };
};

globalThis.localStorage = createStorage();
globalThis.sessionStorage = createStorage();
globalThis.window = {
  name: '',
  dispatchEvent: () => {}
};

const authSession = await import('./impersonationSession.js');

test('unchecked login stores the access token only for the browser session', () => {
  assert.equal(typeof authSession.setAdminAccessToken, 'function');

  authSession.setAdminAccessToken('session-token', false);

  assert.equal(sessionStorage.getItem('serviceToken'), 'session-token');
  assert.equal(localStorage.getItem('serviceToken'), null);
  assert.equal(authSession.getAdminAccessToken(), 'session-token');
});
test('checked login stores the access token persistently', () => {
  authSession.setAdminAccessToken('persistent-token', true);

  assert.equal(localStorage.getItem('serviceToken'), 'persistent-token');
  assert.equal(sessionStorage.getItem('serviceToken'), null);
  assert.equal(authSession.getAdminAccessToken(), 'persistent-token');
  assert.equal(authSession.isAdminSessionPersistent(), true);
});
