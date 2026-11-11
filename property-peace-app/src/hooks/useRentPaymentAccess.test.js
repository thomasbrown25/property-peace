import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRentPaymentAccessRequestLifecycle, getRentPaymentAccessVisibleState, makeRentPaymentAccessScopeKey } from '../utils/rentPaymentAccess.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('readiness lifecycle discards stale organization responses and aborts the old request', async () => {
  const first = deferred();
  const second = deferred();
  const updates = [];
  let firstSignal;
  const lifecycle = createRentPaymentAccessRequestLifecycle((state) => updates.push(structuredClone(state)));
  const scopeA = makeRentPaymentAccessScopeKey({ userId: 7, organizationId: 101 });
  const scopeB = makeRentPaymentAccessScopeKey({ userId: 7, organizationId: 202 });
  const one = lifecycle.begin({ scopeKey: scopeA, request: ({ signal }) => { firstSignal = signal; return first.promise; } });
  await Promise.resolve();
  const two = lifecycle.begin({ scopeKey: scopeB, request: () => second.promise });
  assert.equal(firstSignal.aborted, true);
  first.resolve({ readiness: { organizationId: 101 } });
  await one;
  assert.equal(updates.at(-1).scopeKey, scopeB);
  assert.equal(updates.at(-1).readiness, null);
  second.resolve({ readiness: { organizationId: 202 } });
  await two;
  assert.equal(updates.at(-1).readiness.organizationId, 202);
});

test('hook scopes authenticated readiness and has no approval endpoint or request mutation', async () => {
  const source = await readFile(new URL('./useRentPaymentAccess.js', import.meta.url), 'utf8');
  assert.match(source, /useOrganization\(\)/);
  assert.match(source, /useAuth\(\)/);
  assert.match(source, /makeRentPaymentAccessScopeKey/);
  assert.match(source, /refresh\(\)/);
  assert.doesNotMatch(source, /requestRentPaymentAccess|getRentPaymentAccess[,\s]|requestAccess|loadAccess|requesting/);
});

test('lifecycle clears errors, ignores unmount completions, and remains retryable', async () => {
  const pending = deferred();
  const updates = [];
  const lifecycle = createRentPaymentAccessRequestLifecycle((state) => updates.push(structuredClone(state)));
  const scopeKey = makeRentPaymentAccessScopeKey({ userId: 7, organizationId: 101 });
  await lifecycle.begin({ scopeKey, request: async () => { throw new Error('request failed'); } });
  assert.equal(updates.at(-1).error, 'request failed');
  const completion = lifecycle.begin({ scopeKey, request: () => pending.promise });
  assert.equal(updates.at(-1).error, null);
  lifecycle.dispose();
  const countAtDispose = updates.length;
  pending.resolve({ readiness: {} });
  await completion;
  assert.equal(updates.length, countAtDispose);
  await lifecycle.begin({ scopeKey, request: async () => ({ readiness: { ready: true } }) });
  assert.equal(updates.at(-1).readiness.ready, true);
});

test('organization switching masks prior readiness immediately', () => {
  const visible = getRentPaymentAccessVisibleState({ state: { scopeKey: 'old', configureReadiness: { allowed: true } }, scopeKey: 'new', canFetch: true });
  assert.equal(visible.configureReadiness, null);
  assert.equal(visible.loading, true);
});

test('action readiness API preserves authenticated server decisions and exposes no internal review API', async () => {
  const source = await readFile(new URL('../api/rentPaymentAccess.js', import.meta.url), 'utf8');
  assert.match(source, /api\.get\(`\/api\/feature-readiness\/rent-payments\/\$\{action\}`, \{ signal \}\)/);
  assert.doesNotMatch(source, /api\.post|rent-payment-access/);
});
