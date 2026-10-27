import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPaymentIntentSync } from './paymentIntentSync.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const result = (amount, id = 'pi_1') => ({ data: { success: true, data: { paymentIntentId: id, clientSecret: 'secret', amount } } });
const tick = () => new Promise((resolve) => setImmediate(resolve));

for (const kind of ['rent', 'fee']) {
  test(`${kind}: rapid edit during create retains intent, updates latest amount, never opens stale form`, async () => {
    const first = deferred();
    const update = deferred();
    const calls = [];
    const states = [];
    const scope = { leaseId: 9, chargeId: kind === 'fee' ? 'fee:4' : null, operationId: 'op-1' };
    const coordinator = createPaymentIntentSync({
      post: (path, payload) => { calls.push({ path, payload }); return calls.length === 1 ? first.promise : update.promise; },
      onState: (state) => states.push(state)
    });
    const payload = (amount) => ({ ...scope, amount, description: 'Payment' });
    coordinator.sync({ scope, payload: payload(10), amountCents: 1000 });
    coordinator.sync({ scope, payload: payload(7), amountCents: 700 });
    coordinator.sync({ scope, payload: payload(8), amountCents: 800 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].payload.amount, 10);
    first.resolve(result(10));
    await tick();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].path, '/api/stripe/update-payment-intent');
    assert.deepEqual(calls[1].payload, { ...payload(8), paymentIntentId: 'pi_1' });
    assert.equal(coordinator.ready, false);
    assert.equal(states.at(-1).paymentIntentId, 'pi_1');
    update.resolve(result(8));
    await tick();
    assert.equal(coordinator.ready, true);
    assert.equal(states.at(-1).intentAmountCents, 800);
    assert.equal(calls.length, 2);
    coordinator.dispose();
  });
}

test('invalid amount during create retains intent without opening form until a valid update', async () => {
  const first = deferred();
  const calls = [];
  const sync = createPaymentIntentSync({ post: (path, payload) => { calls.push({ path, payload }); return calls.length === 1 ? first.promise : Promise.resolve(result(6)); }, onState: () => {} });
  const scope = { leaseId: 2, chargeId: null, operationId: 'op' };
  sync.sync({ scope, payload: { ...scope, amount: 10 }, amountCents: 1000 });
  sync.sync({ scope, payload: null, amountCents: null });
  first.resolve(result(10));
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(sync.ready, false);
  sync.sync({ scope, payload: { ...scope, amount: 6 }, amountCents: 600 });
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(sync.ready, true);
});

test('stale lease/charge response is ignored, with no update or ready state', async () => {
  const first = deferred();
  const calls = [];
  const states = [];
  const sync = createPaymentIntentSync({ post: (path, payload) => { calls.push({ path, payload }); return first.promise; }, onState: (state) => states.push(state) });
  const scope = { leaseId: 1, chargeId: 'fee:1', operationId: 'op-1' };
  sync.sync({ scope, payload: { ...scope, amount: 5 }, amountCents: 500 });
  sync.dispose();
  first.resolve(result(5));
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(states.length, 0);
  assert.equal(sync.ready, false);
});

test('failed update retains the created intent, blocks the form and retries update rather than create', async () => {
  const first = deferred();
  const calls = [];
  const states = [];
  const scope = { leaseId: 4, chargeId: 'fee:3', operationId: 'op-3' };
  const sync = createPaymentIntentSync({
    post: (path, payload) => {
      calls.push({ path, payload });
      if (calls.length === 1) return first.promise;
      if (calls.length === 2) return Promise.reject(new Error('update rejected'));
      return Promise.resolve(result(7));
    },
    onState: (state) => states.push(state)
  });
  sync.sync({ scope, payload: { ...scope, amount: 10 }, amountCents: 1000 });
  sync.sync({ scope, payload: { ...scope, amount: 7 }, amountCents: 700 });
  first.resolve(result(10));
  await tick();
  assert.equal(sync.ready, false);
  assert.equal(states.at(-1).paymentIntentId, 'pi_1');
  assert.equal(states.at(-1).error.message, 'update rejected');
  sync.retry();
  await tick();
  assert.equal(sync.ready, true);
  assert.deepEqual(calls.map(({ path }) => path), [
    '/api/stripe/create-payment-intent', '/api/stripe/update-payment-intent', '/api/stripe/update-payment-intent'
  ]);
  assert.equal(calls[2].payload.paymentIntentId, 'pi_1');
  assert.equal(calls[2].payload.chargeId, 'fee:3');
  assert.equal(calls[2].payload.operationId, 'op-3');
});

test('ambiguous create retry uses the original idempotent payload, then updates the latest amount', async () => {
  const calls = [];
  const scope = { leaseId: 5, chargeId: null, operationId: 'op-5' };
  const sync = createPaymentIntentSync({
    post: (path, payload) => {
      calls.push({ path, payload });
      if (calls.length === 1) return Promise.reject(new Error('network'));
      return Promise.resolve(result(payload.amount));
    },
    onState: () => {}
  });
  sync.sync({ scope, payload: { ...scope, amount: 10 }, amountCents: 1000 });
  await tick();
  sync.sync({ scope, payload: { ...scope, amount: 6 }, amountCents: 600 });
  sync.retry();
  await tick();
  assert.deepEqual(calls.map(({ path, payload }) => [path, payload.amount]), [
    ['/api/stripe/create-payment-intent', 10],
    ['/api/stripe/create-payment-intent', 10],
    ['/api/stripe/update-payment-intent', 6]
  ]);
  assert.equal(sync.ready, true);
});

test('component only mounts Stripe and submits when coordinator amount matches valid current amount', async () => {
  const source = await readFile(new URL('../components/drawers/PaymentModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /createPaymentIntentSync/);
  assert.match(source, /if \(!checkoutReady\)/);
  assert.match(source, /disabled=\{amountInvalid \|\| !intentMatchesAmount \|\| !stripe/);
  assert.match(source, /if \(amountInvalid \|\| !intentMatchesAmount \|\| !isCurrent\(\) \|\| !stripe/);
  assert.match(source, /rent\.isFee \? feePayload : \{/);
});
