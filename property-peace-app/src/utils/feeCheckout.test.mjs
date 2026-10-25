import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { feeCheckoutSelection, feeAmountCents, feeIntentPayload, feeSubmissionCopy, feeAttempt } from './feeCheckout.js';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const fee = { chargeId: 'fee:27', type: 'Fee', title: 'Pet fee', remaining: 12.34 };

test('only unpaid fee charge selectors qualify; deposits and paid fees never do', () => {
  assert.deepEqual(feeCheckoutSelection(fee), { chargeId: 'fee:27', title: 'Pet fee', remainingCents: 1234 });
  for (const charge of [{ ...fee, type: 'Deposit' }, { ...fee, remaining: 0 }, { ...fee, chargeId: 'rent:27' },
    { ...fee, chargeId: 'fee:pooled:27' }, { ...fee, remaining: 0.49 }]) {
    assert.equal(feeCheckoutSelection(charge), null);
  }
});

test('partial fee payments are exact cents within 50 cents and the server remaining balance', () => {
  assert.equal(feeAmountCents('0.50', 1234), 50);
  assert.equal(feeAmountCents('7.01', 1234), 701);
  assert.equal(feeAmountCents('12.34', 1234), 1234);
  for (const amount of ['0.49', '12.35', '1.001', '-1', 'abc', '0', '1e2']) assert.equal(feeAmountCents(amount, 1234), null);
});

test('create and update payloads keep one immutable charge selector and operation id', () => {
  const selected = feeCheckoutSelection(fee);
  assert.deepEqual(feeIntentPayload({ leaseId: 8, selection: selected, amount: '2.50', operationId: 'op-1' }),
    { leaseId: 8, chargeId: 'fee:27', amount: 2.5, operationId: 'op-1', description: 'Payment for Pet fee' });
  assert.equal(feeIntentPayload({ leaseId: 8, selection: selected, amount: '0.01', operationId: 'op-1' }), null);
  assert.equal(feeIntentPayload({ leaseId: 8, selection: null, amount: '2.50', operationId: 'op-1' }), null);
});

test('fee confirmation and processing remain pending webhook confirmation', () => {
  for (const status of ['succeeded', 'processing']) {
    const copy = feeSubmissionCopy(status);
    assert.match(copy.message, /fee balance.*webhook|fee balance.*final confirmation/i);
    assert.doesNotMatch(copy.title, /paid/i);
  }
});

test('cancel and retry reuse the same fee operation and original amount, never a rent operation', () => {
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
  const first = feeAttempt(8, 'fee:27', storage, () => 'op-1');
  assert.deepEqual(first, { operationId: 'op-1', amount: null });
  first.amount = 2.5;
  storage.setItem('fee-checkout:8:fee:27', JSON.stringify(first));
  assert.deepEqual(feeAttempt(8, 'fee:27', storage, () => 'op-2'), first);
  assert.notEqual(feeAttempt(8, 'fee:28', storage, () => 'op-3').operationId, first.operationId);
});

test('tenant fee action is scoped, gate-checked and ledger refreshed after submit; landlord stays read-only', async () => {
  const tenant = await source('../pages/tenant/payments.jsx');
  const list = await source('../components/payments/LeaseChargeList.jsx');
  const modal = await source('../components/drawers/PaymentModal.jsx');
  assert.match(tenant, /onPayFee=\{openPaymentForFee\}/);
  assert.match(tenant, /if \(!canInvoke\) return/);
  assert.match(tenant, /setChargeRefresh\(\(count\) => count \+ 1\)/);
  assert.match(list, /onPayFee && charge\.canPayFee/);
  assert.match(modal, /feeIntentPayload/);
  // Once an intent exists, the fee amount must remain the original idempotent attempt.
  assert.match(modal, /<PaymentSummary rent=\{rent\} amount=\{amount\} setAmount=\{setAmount\} disabled=\{processing \|\| rent\?\.isFee\}/);
  assert.match(modal, /chargeId: rent\.chargeId/);
  assert.match(modal, /paymentOperationIdRef\.current/);
  assert.match(modal, /paymentIntent\?\.status === 'succeeded' \|\| paymentIntent\?\.status === 'processing'/);
  assert.match(modal, /onSuccess\(\)/);
  assert.match(list, /oldest-first across the lease/);
  assert.doesNotMatch(await source('../sections/landlord/finances/PaymentsTab.jsx'), /onPayFee=/);
});
