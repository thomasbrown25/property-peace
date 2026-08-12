import test from 'node:test';
import assert from 'node:assert/strict';

import { createPortfolioScopeLifecycle, makePortfolioScopeKey } from './portfolioSummaryScope.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('A action completion is rejected after synchronous switch to B', async () => {
  const states = [];
  const lifecycle = createPortfolioScopeLifecycle((state) => states.push(structuredClone(state)));
  const scopeA = makePortfolioScopeKey({ userId: 7, organizationId: 101 });
  const scopeB = makePortfolioScopeKey({ userId: 7, organizationId: 202 });
  const pendingA = deferred();

  lifecycle.switchScope(scopeA);
  const actionA = lifecycle.runAction('lease-A', () => pendingA.promise);
  assert.equal(states.at(-1).actions['lease-A'], 'loading');

  lifecycle.switchScope(scopeB);
  assert.deepEqual(states.at(-1), {
    scopeKey: scopeB,
    items: [],
    generating: false,
    generationAttempted: false,
    generationError: null,
    detailModal: null,
    approveLoading: false,
    approveState: null,
    actions: {}
  });
  assert.equal(lifecycle.visibleState(scopeB).items.length, 0);
  assert.equal(lifecycle.visibleState(scopeA), null);

  pendingA.resolve({ success: true, id: 'lease-A' });
  assert.equal(await actionA, false);
  assert.deepEqual(states.at(-1).actions, {});
  assert.equal(JSON.stringify(states).includes('completed'), false);
  assert.equal(JSON.stringify(states.at(-1)).includes('lease-A'), false);
});

test('portfolio scope includes authoritative user and active organization', () => {
  const original = makePortfolioScopeKey({ userId: 7, organizationId: 101 });
  assert.notEqual(original, makePortfolioScopeKey({ userId: 8, organizationId: 101 }));
  assert.notEqual(original, makePortfolioScopeKey({ userId: 7, organizationId: 202 }));
});

test('portfolio scope closes and hides action state while OrganizationContext is loading', () => {
  assert.equal(makePortfolioScopeKey({ userId: 7, organizationId: 101, organizationLoading: true }), null);
  assert.notEqual(makePortfolioScopeKey({ userId: 7, organizationId: 101, organizationLoading: false }), null);
});

test('refresh synchronously clears actionable state and rejects an in-flight completion even when refetch fails', async () => {
  const states = [];
  const lifecycle = createPortfolioScopeLifecycle((state) => states.push(structuredClone(state)));
  const scope = makePortfolioScopeKey({ userId: 7, organizationId: 101 });
  const pendingAction = deferred();
  const pendingRefresh = deferred();

  lifecycle.switchScope(scope);
  lifecycle.publishSummary(['old item'], {
    actions: { old: 'completed' },
    detailModal: { id: 'old detail' }
  });
  const action = lifecycle.runAction('active', () => pendingAction.promise);
  const refresh = lifecycle.refresh(() => pendingRefresh.promise);

  assert.deepEqual(states.at(-1), {
    scopeKey: scope,
    items: [],
    generating: false,
    generationAttempted: false,
    generationError: null,
    detailModal: null,
    approveLoading: false,
    approveState: null,
    actions: {}
  });

  pendingAction.resolve({ success: true });
  assert.equal(await action, false);
  pendingRefresh.resolve(Promise.reject(new Error('refresh failed')));
  await assert.rejects(refresh, /refresh failed/);
  assert.deepEqual(states.at(-1).items, []);
  assert.deepEqual(states.at(-1).actions, {});
  assert.equal(states.at(-1).detailModal, null);
});
