import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { isTerminalSignalRAuthError } from './signalRRetry.js';

test('does not retry SignalR negotiate errors that report HTTP 403 in nested errors', () => {
  const error = {
    message: 'Failed to complete negotiation with the server.',
    innerError: new Error("Unexpected status code returned from negotiate '403'.")
  };

  assert.equal(isTerminalSignalRAuthError(error), true);
});

test('does not retry SignalR errors that expose HTTP 403 as a status code', () => {
  assert.equal(isTerminalSignalRAuthError({ statusCode: 403 }), true);
  assert.equal(isTerminalSignalRAuthError({ cause: { response: { status: 403 } } }), true);
});

test('continues treating HTTP 401 as terminal', () => {
  assert.equal(isTerminalSignalRAuthError(new Error('Unauthorized')), true);
});

test('continues retrying transient SignalR transport errors', () => {
  assert.equal(isTerminalSignalRAuthError(new Error('WebSocket closed unexpectedly.')), false);
});

for (const hook of ['useSignalRNotifications', 'useSignalRConversations']) {
  test(`${hook} stops the 403 loop and can try again after credentials change`, async () => {
    const source = readFileSync(new URL(`../hooks/${hook}.js`, import.meta.url), 'utf8')
      .replace(/^import .*;\r?\n/gm, '')
      .replace('import.meta.env.VITE_APP_API_URL', 'undefined')
      .replace('export default function', 'function');
    let token = 'old-session';
    let starts = 0;
    let scheduled = 0;
    const bindings = {
      useAuth: () => ({ user: { id: 42 }, isLoggedIn: true }),
      useState: (value) => [value, () => {}],
      useRef: (current) => ({ current }),
      useEffect: () => {},
      useCallback: (callback) => callback,
      getActiveAccessToken: () => token,
      LogLevel: { Error: 4 },
      isTerminalSignalRAuthError,
      setTimeout: () => { scheduled++; },
      clearTimeout: () => {},
      HubConnectionBuilder: class {
        withUrl() { return this; }
        withAutomaticReconnect() { return this; }
        configureLogging() { return this; }
        build() {
          return {
            on() {}, onclose() {}, onreconnecting() {}, onreconnected() {},
            async start() {
              starts++;
              throw new Error("Failed to complete negotiation with the server: Forbidden: Status code '403'");
            }
          };
        }
      }
    };
    const mount = new Function(...Object.keys(bindings), `${source}\nreturn ${hook}();`);
    const { reconnect } = mount(...Object.values(bindings));

    await reconnect();
    await reconnect();
    assert.equal(starts, 1);
    assert.equal(scheduled, 0);

    token = 'new-session';
    await reconnect();
    assert.equal(starts, 2);
    assert.equal(scheduled, 0);
  });
}
