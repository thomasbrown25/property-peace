import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRentPayment, pendingRentPayment } from '../src/features/tenantPayments/model.ts';
import { submitRentPayment } from '../src/features/tenantPayments/checkout.ts';
import { createTenantPaymentsAPI } from '../src/api/tenantPaymentsAPI.ts';

const lease = { id: 17, isActive: true, rentCollectionByPlatform: true };
const rent = { leaseId: 17, rentDue: 825.75 };
const gate = { allowed: true, blockers: [] };
const valid = value => parseRentPayment(value, rent.rentDue);

test('amount parser accepts exact cents and full due, rejects out-of-range, malformed and sub-Stripe minimum', () => {
  assert.equal(valid('0.50'), 0.5);
  assert.equal(valid('825.75'), 825.75);
  assert.equal(valid('1,000'), null);
  for (const input of ['', ' ', '.50', '00.50', '-1', '1e2', '1.001', '0.49', '825.76', 'Infinity', '1.2.3', '1\n2']) assert.equal(valid(input), null, input);
  assert.equal(parseRentPayment('0.50', 0.49), null);
  assert.equal(parseRentPayment('1.00', NaN), null);
  assert.equal(parseRentPayment('1.00', 1.001), null);
});

test('pending state is not paid until server finalizes matched intent; failed and canceled release hold', () => {
  const pending = { paymentIntentId: 'pi_123', amount: 100 };
  assert.equal(pendingRentPayment(pending, []), true);
  assert.equal(pendingRentPayment(pending, [{ id: 1, stripePaymentIntentId: 'pi_other', status: 'Paid' }]), true);
  assert.equal(pendingRentPayment(pending, [{ id: 2, stripePaymentIntentId: 'pi_123', status: 'Processing' }]), true);
  assert.equal(pendingRentPayment(pending, [{ id: 2, stripePaymentIntentId: 'pi_123', status: 'Paid' }]), false);
  assert.equal(pendingRentPayment(pending, [{ id: 2, stripePaymentIntentId: 'pi_123', status: 'Failed' }]), false);
  assert.equal(pendingRentPayment(pending, [{ id: 2, stripePaymentIntentId: 'pi_123', status: 'Canceled' }]), false);
});

test('submission rechecks live rent and readiness, sends selected partial amount and fresh operation each time', async () => {
  const calls = []; let operation = 0;
  const deps = { leases: async () => [lease], readiness: async () => gate, rent: async () => rent,
    createIntent: async (id, amount, op) => { calls.push([id, amount, op]); return { clientSecret: 'secret', paymentIntentId: 'pi_123' }; } };
  const context = { lease, displayedRent: rent, input: '100.25', isCurrent: () => true, uuid: () => `operation-${++operation}`, checkout: async () => 'submitted', api: deps };
  assert.deepEqual(await submitRentPayment(context), { result: 'submitted', amount: 100.25, paymentIntentId: 'pi_123' });
  await submitRentPayment(context);
  assert.deepEqual(calls, [[17, 100.25, 'operation-1'], [17, 100.25, 'operation-2']]);
});

test('changed balance, denied gate, inactive lease and stale context never create an intent', async () => {
  let calls = 0;
  const api = { leases: async () => [lease], readiness: async () => gate, rent: async () => rent, createIntent: async () => { calls++; return {}; } };
  const args = { api, lease, displayedRent: rent, input: '100', uuid: () => 'op', checkout: async () => 'submitted', isCurrent: () => true };
  await assert.rejects(submitRentPayment({ ...args, api: { ...api, rent: async () => ({ ...rent, rentDue: 90 }) } }), /changed|refresh/i);
  await assert.rejects(submitRentPayment({ ...args, api: { ...api, readiness: async () => ({ allowed: false, blockers: [] }) } }), /unavailable|refresh/i);
  await assert.rejects(submitRentPayment({ ...args, api: { ...api, leases: async () => [{ ...lease, isActive: false }] } }), /unavailable|refresh/i);
  await assert.rejects(submitRentPayment({ ...args, isCurrent: () => false }), /changed|refresh/i);
  assert.equal(calls, 0);
});

test('stale context after intent creation cannot open PaymentSheet', async () => {
  let active = true, sheet = 0;
  const api = { leases: async () => [lease], readiness: async () => gate, rent: async () => rent, createIntent: async () => { active = false; return { clientSecret: 'secret', paymentIntentId: 'pi_123' }; } };
  await assert.rejects(submitRentPayment({ api, lease, displayedRent: rent, input: '100', uuid: () => 'op', isCurrent: () => active, checkout: async () => { sheet++; return 'submitted'; } }), /changed|refresh/i);
  assert.equal(sheet, 0);
});

test('sheet failure after intent creation retains intent for reconciliation without marking it paid', async () => {
  const seen = []; const api = { leases: async () => [lease], readiness: async () => gate, rent: async () => rent,
    createIntent: async () => ({ clientSecret: 'secret', paymentIntentId: 'pi_123' }) };
  await assert.rejects(submitRentPayment({ api, lease, displayedRent: rent, input: '5.00', uuid: () => 'op',
    isCurrent: () => true, onIntentCreated: intent => seen.push(intent), checkout: async () => { throw new Error('Sheet failed'); } }), /Sheet failed/);
  assert.deepEqual(seen, [{ paymentIntentId: 'pi_123', amount: 5 }]);
  assert.equal(pendingRentPayment(seen[0], []), true);
});

test('transport rejects amounts below Stripe minimum before posting', async () => {
  let posted = false;
  const api = createTenantPaymentsAPI({ get: async () => null, post: async () => { posted = true; } });
  await assert.rejects(api.createIntent(17, 0.49, '123e4567-e89b-42d3-a456-426614174000'), /amount/i);
  assert.equal(posted, false);
});
