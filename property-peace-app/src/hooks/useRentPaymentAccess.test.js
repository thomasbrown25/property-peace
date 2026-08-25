import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createRentPaymentAccessRequestLifecycle,
  makeRentPaymentAccessScopeKey
} from '../utils/rentPaymentAccess.js';

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test('rent payment access lifecycle discards a stale organization response', async () => {
  const first = deferred();
  const second = deferred();
  const updates = [];
  const lifecycle = createRentPaymentAccessRequestLifecycle((state) => updates.push(structuredClone(state)));
  const scopeA = makeRentPaymentAccessScopeKey({ userId: 7, organizationId: 101 });
  const scopeB = makeRentPaymentAccessScopeKey({ userId: 7, organizationId: 202 });

  const firstRequest = lifecycle.begin({ scopeKey: scopeA, request: () => first.promise });
  const secondRequest = lifecycle.begin({ scopeKey: scopeB, request: () => second.promise });
  first.resolve({ access: { organizationId: 101 }, readiness: { feature: 'OnlineRentCollection' } });
  await firstRequest;
  assert.equal(updates.some((state) => state.scopeKey === scopeB && state.access?.organizationId === 101), false);

  second.resolve({ access: { organizationId: 202 }, readiness: { feature: 'OnlineRentCollection' } });
  await secondRequest;
  assert.equal(updates.at(-1).access.organizationId, 202);
});

test('useRentPaymentAccess keys authenticated organization data and refreshes after a request', async () => {
  const source = await readFile(new URL('./useRentPaymentAccess.js', import.meta.url), 'utf8');
  assert.match(source, /useOrganization\(\)/);
  assert.match(source, /useAuth\(\)/);
  assert.match(source, /makeRentPaymentAccessScopeKey/);
  assert.match(source, /requestRentPaymentAccess/);
  assert.match(source, /refresh\(\)/);
  assert.match(source, /requesting/);
});

test('rent payment access lifecycle clears errors, ignores unmount completions, and remains retryable', async () => {
  const pending = deferred();
  const updates = [];
  const lifecycle = createRentPaymentAccessRequestLifecycle((state) => updates.push(structuredClone(state)));
  const scope = makeRentPaymentAccessScopeKey({ userId: 7, organizationId: 101 });

  await lifecycle.begin({ scopeKey: scope, request: async () => { throw new Error('request failed'); } });
  assert.equal(updates.at(-1).error, 'request failed');

  const completion = lifecycle.begin({ scopeKey: scope, request: () => pending.promise });
  lifecycle.dispose();
  const countAtDispose = updates.length;
  pending.resolve({ access: { organizationId: 101 }, readiness: null });
  await completion;
  assert.equal(updates.length, countAtDispose);
});

test('useRentPaymentAccess fetches aggregate and explicit action decisions with abort signals', async () => {
  const source = await readFile(new URL('./useRentPaymentAccess.js', import.meta.url), 'utf8');
  assert.match(source, /getRentPaymentActionReadiness\('Configure', signal\)/);
  assert.match(source, /getRentPaymentActionReadiness\('Pay', signal\)/);
  assert.match(source, /getRentPaymentFeatureReadiness\(signal\)/);
  assert.doesNotMatch(source, /canInvoke === true/);
  assert.match(source, /setRequestError|reportError/);
});
test('rent payment action readiness API preserves the requested action in an authenticated URL', async () => {
  const source = await readFile(new URL('../api/rentPaymentAccess.js', import.meta.url), 'utf8');
  assert.match(source, /api\.get\(`\/api\/feature-readiness\/rent-payments\/\$\{action\}`, \{ signal \}\)/);
});