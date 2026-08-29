import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canCreateInitialStripeAccount,
  canManageStripeAccount,
  createStripeOrganizationRequestLifecycle,
  getInitialStripeOnboardingUrl,
  makeStripeOrganizationScopeKey
} from './stripeOrganizationRequestLifecycle.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('Stripe organization lifecycle clears immediately and ignores an old organization response that resolves last', async () => {
  const oldRequest = deferred();
  const newRequest = deferred();
  const events = [];
  const lifecycle = createStripeOrganizationRequestLifecycle((scopeKey) => events.push({ type: 'reset', scopeKey }));
  const oldScope = makeStripeOrganizationScopeKey(101);
  const newScope = makeStripeOrganizationScopeKey(202);
  let oldSignal;

  lifecycle.setScope(oldScope);
  const oldCompletion = lifecycle.run({
    scopeKey: oldScope,
    channel: 'account-status',
    request: ({ signal }) => {
      oldSignal = signal;
      return oldRequest.promise;
    },
    onSuccess: (value) => events.push({ type: 'status', scopeKey: oldScope, value })
  });

  lifecycle.setScope(newScope);
  assert.equal(oldSignal.aborted, true);
  assert.deepEqual(events.at(-1), { type: 'reset', scopeKey: newScope });

  const newCompletion = lifecycle.run({
    scopeKey: newScope,
    channel: 'account-status',
    request: () => newRequest.promise,
    onSuccess: (value) => events.push({ type: 'status', scopeKey: newScope, value })
  });

  newRequest.resolve({ accountId: 'acct_new', canManageAccount: true });
  await newCompletion;
  oldRequest.resolve({ accountId: 'acct_old', canManageAccount: true });
  await oldCompletion;

  assert.equal(events.some((event) => event.type === 'status' && event.value.accountId === 'acct_old'), false);
  assert.deepEqual(events.at(-1), {
    type: 'status',
    scopeKey: newScope,
    value: { accountId: 'acct_new', canManageAccount: true }
  });
});

test('Stripe organization lifecycle ignores an older same-organization response on the same channel', async () => {
  const first = deferred();
  const second = deferred();
  const values = [];
  const scopeKey = makeStripeOrganizationScopeKey('org-a');
  const lifecycle = createStripeOrganizationRequestLifecycle(() => {});
  lifecycle.setScope(scopeKey);

  const firstCompletion = lifecycle.run({
    scopeKey,
    channel: 'bank-accounts',
    request: () => first.promise,
    onSuccess: (value) => values.push(value)
  });
  const secondCompletion = lifecycle.run({
    scopeKey,
    channel: 'bank-accounts',
    request: () => second.promise,
    onSuccess: (value) => values.push(value)
  });

  second.resolve(['current']);
  await secondCompletion;
  first.resolve(['stale']);
  await firstCompletion;

  assert.deepEqual(values, [['current']]);
});

test('Stripe request callbacks and finally handlers are suppressed after organization invalidation', async () => {
  const pending = deferred();
  const callbacks = [];
  const oldScope = makeStripeOrganizationScopeKey(1);
  const lifecycle = createStripeOrganizationRequestLifecycle(() => {});
  lifecycle.setScope(oldScope);

  const completion = lifecycle.run({
    scopeKey: oldScope,
    channel: 'management-session',
    request: () => pending.promise,
    onSuccess: () => callbacks.push('success'),
    onError: () => callbacks.push('error'),
    onFinally: () => callbacks.push('finally')
  });
  lifecycle.setScope(makeStripeOrganizationScopeKey(2));
  pending.resolve('late');
  await completion;

  assert.deepEqual(callbacks, []);
});

test('Stripe account management requires an explicit CanManageAccount true value', () => {
  assert.equal(canManageStripeAccount({ canManageAccount: true }), true);
  assert.equal(canManageStripeAccount({ CanManageAccount: true }), true);
  assert.equal(canManageStripeAccount({ canManageAccount: false }), false);
  assert.equal(canManageStripeAccount({ CanManageAccount: false }), false);
  assert.equal(canManageStripeAccount({}), false);
  assert.equal(canManageStripeAccount(null), false);
});

test('captured Connect callbacks stay invalid after switching away and back to the same organization', () => {
  const scope = makeStripeOrganizationScopeKey(1);
  const lifecycle = createStripeOrganizationRequestLifecycle(() => {});
  lifecycle.setScope(scope);
  const oldConnectGeneration = lifecycle.capture(scope);

  lifecycle.setScope(makeStripeOrganizationScopeKey(2));
  lifecycle.setScope(scope);

  assert.equal(oldConnectGeneration.isCurrent(), false);
  assert.equal(lifecycle.capture(scope).isCurrent(), true);
});

test('initial Stripe creation is allowed only after a successful no-account status load in the current enabled organization', () => {
  const allowed = {
    statusLoadedSuccessfully: true,
    status: { AccountId: null, CanManageAccount: false },
    rentCanInvoke: true,
    organizationId: 77
  };
  assert.equal(canCreateInitialStripeAccount(allowed), true);
  assert.equal(canCreateInitialStripeAccount({ ...allowed, statusLoadedSuccessfully: false }), false);
  assert.equal(canCreateInitialStripeAccount({ ...allowed, status: null }), false);
  assert.equal(canCreateInitialStripeAccount({ ...allowed, status: { AccountId: 'acct_existing' } }), false);
  assert.equal(canCreateInitialStripeAccount({ ...allowed, rentCanInvoke: false }), false);
  assert.equal(canCreateInitialStripeAccount({ ...allowed, organizationId: null }), false);
});

test('first-account creation follows only a successful hosted onboarding URL response', () => {
  assert.equal(getInitialStripeOnboardingUrl({
    success: true,
    data: { accountId: 'acct_new', onboardingUrl: 'https://connect.stripe.test/onboard' }
  }), 'https://connect.stripe.test/onboard');
  assert.equal(getInitialStripeOnboardingUrl({ success: true, data: { accountId: 'acct_new' } }), null);
  assert.equal(getInitialStripeOnboardingUrl({ success: false, data: { onboardingUrl: 'https://evil.test' } }), null);
});

test('Stripe organization scope cannot be formed without the current organization id', () => {
  assert.equal(makeStripeOrganizationScopeKey(null), null);
  assert.equal(makeStripeOrganizationScopeKey(undefined), null);
  assert.equal(makeStripeOrganizationScopeKey(''), null);
  assert.notEqual(makeStripeOrganizationScopeKey(101), makeStripeOrganizationScopeKey(202));
});
