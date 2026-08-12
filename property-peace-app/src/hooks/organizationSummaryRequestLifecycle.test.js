import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canFetchOrganizationSummary,
  createOrganizationSummaryRequestLifecycle,
  getVisibleOrganizationSummaryState,
  makeOrganizationSummaryScopeKey
} from './organizationSummaryRequestLifecycle.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function successfulSummary(data) {
  return { data: { success: true, data } };
}

test('organization summary ignores organization A after switching the same user to organization B', async () => {
  const requestA = deferred();
  const requestB = deferred();
  const states = [];
  let signalA;
  const lifecycle = createOrganizationSummaryRequestLifecycle((state) => {
    states.push(structuredClone(state));
  });
  const scopeA = makeOrganizationSummaryScopeKey({ userId: 7, organizationId: 101 });
  const scopeB = makeOrganizationSummaryScopeKey({ userId: 7, organizationId: 202 });

  const completionA = lifecycle.begin({
    scopeKey: scopeA,
    request: ({ signal }) => {
      assert.equal(signal.aborted, false);
      signalA = signal;
      return requestA.promise;
    }
  });

  const completionB = lifecycle.begin({
    scopeKey: scopeB,
    request: ({ signal }) => {
      assert.equal(signal.aborted, false);
      return requestB.promise;
    }
  });

  assert.equal(signalA.aborted, true);
  assert.equal(states.at(-1).scopeKey, scopeB);
  assert.deepEqual(states.at(-1), {
    scopeKey: scopeB,
    data: null,
    loading: true,
    error: null
  });

  requestA.resolve(successfulSummary({
    properties: [{ id: 'property-a' }],
    tenants: [{ id: 'tenant-a' }]
  }));
  await completionA;

  assert.deepEqual(states.at(-1), {
    scopeKey: scopeB,
    data: null,
    loading: true,
    error: null
  });
  assert.equal(states.some((state) => state.scopeKey === scopeB && state.data?.properties?.[0]?.id === 'property-a'), false);
  assert.equal(states.some((state) => state.scopeKey === scopeB && state.data?.tenants?.[0]?.id === 'tenant-a'), false);

  requestB.resolve(successfulSummary({
    properties: [{ id: 'property-b' }],
    tenants: [{ id: 'tenant-b' }]
  }));
  await completionB;

  assert.deepEqual(states.at(-1), {
    scopeKey: scopeB,
    data: {
      properties: [{ id: 'property-b' }],
      tenants: [{ id: 'tenant-b' }]
    },
    loading: false,
    error: null
  });
});

test('organization summary scope keys include both user and organization', () => {
  const original = makeOrganizationSummaryScopeKey({ userId: 7, organizationId: 101 });

  assert.notEqual(original, makeOrganizationSummaryScopeKey({ userId: 8, organizationId: 101 }));
  assert.notEqual(original, makeOrganizationSummaryScopeKey({ userId: 7, organizationId: 202 }));
});

test('organization summary synchronously hides same-scope data whenever fetching becomes ineligible', () => {
  const scopeKey = makeOrganizationSummaryScopeKey({ userId: 7, organizationId: 101 });
  const loaded = { scopeKey, data: { properties: [{ id: 1 }] }, loading: false, error: null };

  assert.deepEqual(getVisibleOrganizationSummaryState({ state: loaded, scopeKey, canFetch: false }), {
    data: null,
    loading: false,
    error: null
  });
});

test('organization summary clear invalidates an adapter that ignores abort', async () => {
  const pending = deferred();
  const states = [];
  let signal;
  const lifecycle = createOrganizationSummaryRequestLifecycle((state) => states.push(state));
  const scopeKey = makeOrganizationSummaryScopeKey({ userId: 7, organizationId: 101 });
  const completion = lifecycle.begin({
    scopeKey,
    request: (context) => {
      signal = context.signal;
      return pending.promise;
    }
  });

  lifecycle.clear(scopeKey);
  assert.equal(signal.aborted, true);
  pending.resolve(successfulSummary({ properties: [{ id: 'late' }] }));
  await completion;

  assert.deepEqual(states.at(-1), { scopeKey, data: null, loading: false, error: null });
});

test('organization summary dispose invalidates late success without publishing disposal state', async () => {
  const pending = deferred();
  const states = [];
  const lifecycle = createOrganizationSummaryRequestLifecycle((state) => states.push(state));
  const scopeKey = makeOrganizationSummaryScopeKey({ userId: 7, organizationId: 101 });
  const completion = lifecycle.begin({ scopeKey, request: () => pending.promise });
  const stateCount = states.length;

  lifecycle.dispose();
  pending.resolve(successfulSummary({ properties: [{ id: 'late' }] }));
  await completion;

  assert.equal(states.length, stateCount);
});

test('organization summary repeated same-scope refetch ignores the first late response', async () => {
  const first = deferred();
  const second = deferred();
  const states = [];
  const lifecycle = createOrganizationSummaryRequestLifecycle((state) => states.push(state));
  const scopeKey = makeOrganizationSummaryScopeKey({ userId: 7, organizationId: 101 });
  const firstCompletion = lifecycle.begin({ scopeKey, request: () => first.promise });
  const secondCompletion = lifecycle.begin({ scopeKey, request: () => second.promise });

  first.resolve(successfulSummary({ marker: 'stale' }));
  second.resolve(successfulSummary({ marker: 'current' }));
  await Promise.all([firstCompletion, secondCompletion]);

  assert.equal(states.some((state) => state.data?.marker === 'stale'), false);
  assert.equal(states.at(-1).data.marker, 'current');
});

test('organization summary publishes current errors but treats AbortError as cancellation', async () => {
  const states = [];
  const lifecycle = createOrganizationSummaryRequestLifecycle((state) => states.push(state));
  const scopeKey = makeOrganizationSummaryScopeKey({ userId: 7, organizationId: 101 });

  await lifecycle.begin({ scopeKey, request: async () => { throw new Error('network down'); } });
  assert.equal(states.at(-1).error, 'network down');

  await lifecycle.begin({ scopeKey, request: async () => { throw new DOMException('cancelled', 'AbortError'); } });
  assert.deepEqual(states.at(-1), { scopeKey, data: null, loading: false, error: null });
});

test('organization summary cannot form a request scope without the authoritative current organization', () => {
  assert.equal(makeOrganizationSummaryScopeKey({ userId: 7, organizationId: null }), null);
  assert.equal(makeOrganizationSummaryScopeKey({ userId: 7, organizationId: undefined }), null);
});

test('organization summary eligibility blocks absent/loading organization context and tenant-only users', () => {
  const scopeKey = makeOrganizationSummaryScopeKey({ userId: 7, organizationId: 101 });

  assert.equal(canFetchOrganizationSummary({ scopeKey: null, organizationLoading: false, isTenantOnly: false }), false);
  assert.equal(canFetchOrganizationSummary({ scopeKey, organizationLoading: true, isTenantOnly: false }), false);
  assert.equal(canFetchOrganizationSummary({ scopeKey, organizationLoading: false, isTenantOnly: true }), false);
  assert.equal(canFetchOrganizationSummary({ scopeKey, organizationLoading: false, isTenantOnly: false }), true);
});
