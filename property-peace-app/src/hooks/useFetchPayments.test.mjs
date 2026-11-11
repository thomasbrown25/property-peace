import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('./useFetchPayments.js', import.meta.url), 'utf8');
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

// Execute the real hook with controlled hook state and deferred dispatch results.
function harness() {
  const slots = [];
  const requests = [];
  let cursor = 0;
  let effects = [];
  const same = (a, b) => a && b.every((v, i) => Object.is(v, a[i]));
  const dispatch = (leaseId) => {
    const pending = deferred();
    requests.push({ leaseId, ...pending });
    return pending.promise;
  };
  const useState = (initial) => {
    const index = cursor++;
    slots[index] ??= { value: initial };
    return [slots[index].value, (value) => { slots[index].value = value; }];
  };
  const useRef = (initial) => {
    const index = cursor++;
    slots[index] ??= { current: initial };
    return slots[index];
  };
  const useCallback = (callback, deps) => {
    const index = cursor++;
    if (!same(slots[index]?.deps, deps)) slots[index] = { callback, deps };
    return slots[index].callback;
  };
  const useEffect = (effect, deps) => {
    const index = cursor++;
    if (!same(slots[index]?.deps, deps)) {
      effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, cleanup: effect() };
      });
    }
  };
  const hook = new Function('useState', 'useRef', 'useCallback', 'useEffect', 'useDispatch', 'getPayments',
    source.replace(/^import .*;\r?\n/gm, '').replace('export default function', 'function') + '\nreturn useFetchPayments;'
  )(useState, useRef, useCallback, useEffect, () => dispatch, (id) => id);
  return {
    requests,
    render(id) { cursor = 0; return hook(id); },
    flush() { const pending = effects; effects = []; pending.forEach((effect) => effect()); },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); }
  };
}

test('payment thunk returns scoped success/failure results while preserving Redux updates', async () => {
  const actionSource = fs.readFileSync(new URL('../store/payment/payment.action.js', import.meta.url), 'utf8');
  const types = { GET_PAYMENTS_SUCCESS: 'success', GET_PAYMENTS_FAILURE: 'failure' };
  const actions = [];
  const load = new Function('axiosServices', 'PAYMENT_ACTION_TYPES',
    actionSource.replace(/^import .*;\r?\n/gm, '').replaceAll('export const ', 'const ') + '\nreturn getPayments;'
  );
  const payments = [{ id: 'paid' }];
  const success = load({ get: async (url) => { assert.equal(url, '/api/payment/42'); return { data: payments }; } }, types);
  assert.deepEqual(await success(42)((action) => actions.push(action)), { payments, error: null });
  assert.deepEqual(actions.pop(), { type: 'success', payload: payments });
  const failure = load({ get: async () => { throw new Error('Offline'); } }, types);
  assert.deepEqual(await failure(42)((action) => actions.push(action)), { payments: [], error: 'Offline' });
  assert.deepEqual(actions.pop(), { type: 'failure', payload: 'Offline' });
});

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('first render is loading and payments are not exposed until completion, including empty success', async () => {
  const h = harness();
  assert.equal(h.render(1).loading, true);
  h.flush();
  assert.deepEqual(h.render(1).payments, []);
  h.requests[0].resolve({ payments: [], error: null });
  await settle();
  assert.equal(h.render(1).loading, false);
  assert.equal(h.render(1).error, null);
});

test('lease switches synchronously mask old data and ignore late previous-lease responses', async () => {
  const h = harness();
  h.render(1); h.flush();
  h.requests[0].resolve({ payments: [{ id: 'old' }], error: null });
  await settle();
  assert.equal(h.render(1).payments[0].id, 'old');
  const switched = h.render(2);
  assert.deepEqual(switched.payments, []);
  assert.equal(switched.loading, true);
  h.flush();
  h.render(3); h.flush();
  h.requests[2].resolve({ payments: [{ id: 'current' }], error: null });
  await settle();
  h.requests[1].resolve({ payments: [{ id: 'stale' }], error: null });
  await settle();
  assert.equal(h.render(3).payments[0].id, 'current');
});

test('failed loads stop the spinner and can be retried without displaying stale statuses', async () => {
  const h = harness();
  h.render(1); h.flush();
  h.requests[0].resolve({ payments: [], error: 'Network failed' });
  await settle();
  assert.equal(h.render(1).loading, false);
  assert.equal(h.render(1).error, 'Network failed');
  const completion = h.render(1).refetch();
  assert.equal(h.render(1).loading, true);
  assert.equal(h.render(1).error, null);
  h.requests[1].resolve({ payments: [{ id: 'paid' }], error: null });
  await completion;
  assert.equal(h.render(1).payments[0].id, 'paid');
});

test('unmount invalidates pending completions', async () => {
  const h = harness();
  h.render(1); h.flush(); h.unmount();
  h.requests[0].resolve({ payments: [{ id: 'ignored' }], error: null });
  await settle();
  assert.deepEqual(h.render(1).payments, []);
});

test('lease timeline gates status cards behind blank loading/error states and reveals in a bounded reduced-motion-safe stagger', () => {
  const view = fs.readFileSync(new URL('../sections/landlord/leases/LeaseDetailView.jsx', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../pages/landlord/lease.jsx', import.meta.url), 'utf8');
  const history = view.slice(view.indexOf('<SectionCard title="Rent payment history">'), view.indexOf('<LeaseMoveInCard', view.indexOf('<SectionCard title="Rent payment history">')));
  assert.ok(history.indexOf('paymentsLoading ?') < history.indexOf('paymentTimeline.length ?'));
  assert.ok(history.indexOf('paymentsError ?') < history.indexOf('paymentTimeline.length ?'));
  const loadingStart = history.indexOf('paymentsLoading ?');
  const errorStart = history.indexOf('paymentsError ?');
  const timelineStart = history.indexOf('paymentTimeline.length ?');
  assert.ok(loadingStart >= 0 && errorStart > loadingStart && timelineStart > errorStart);
  const loading = history.slice(loadingStart, errorStart);
  assert.match(loading, /role="status" aria-busy="true" aria-label="Loading payment history"/);
  assert.match(loading, /minHeight: 126/);
  assert.doesNotMatch(loading, /CircularProgress|Skeleton|Typography|paymentTimeline\.map/);
  assert.match(history.slice(errorStart, timelineStart), /role="alert"/);
  assert.match(history, /onClick=\{onRetryPayments\}/);
  assert.match(history, /Math\.min\(index \* 55, 660\)/);
  assert.match(history, /\.\.\.cardDealAnimationSx/);
  const animation = view.slice(view.indexOf('const cardDealAnimationSx = {'), view.indexOf('function LeaseMoveInCard('));
  assert.match(animation, /translateX\(-28px\)/);
  assert.match(animation, /prefers-reduced-motion: reduce/);
  assert.match(animation, /animation: 'none'/);
  assert.match(page, /paymentsLoading=\{paymentsLoading\}/);
  assert.match(page, /paymentsError=\{paymentsError\}/);
});
