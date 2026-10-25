import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTenantPaymentsAPI } from '../src/api/tenantPaymentsAPI.ts';
import { canPayFee, pendingFeePayment } from '../src/features/tenantPayments/model.ts';
import { submitFeePayment } from '../src/features/tenantPayments/checkout.ts';

const lease = { id: 17, isActive: true, rentCollectionByPlatform: true };
const gate = { allowed: true, blockers: [] };
const fee = { chargeId: 'fee:41', type: 'Fee', title: 'Pet fee', dueDate: null, amount: 100, paid: 25, remaining: 75, payments: [] };
const deposit = { ...fee, chargeId: 'deposit:security:17', type: 'Deposit' };
const uuid = '123e4567-e89b-42d3-a456-426614174000';
const args = (api, overrides = {}) => ({ api, lease, displayedFee: fee, input: '12.50', uuid: () => uuid, isCurrent: () => true, checkout: async () => 'submitted', ...overrides });
const api = { leases: async () => [lease], readiness: async () => gate, charges: async () => [fee], createIntent: async () => ({ clientSecret: 'pi_abc_secret_xyz', paymentIntentId: 'pi_abc' }) };

test('only payable fee rows are offered; processing and deposits never get a Pay action', () => {
  assert.equal(canPayFee(lease, fee, gate), true);
  for (const charge of [deposit, { ...fee, type: 'Deposit' }, { ...fee, chargeId: 'fee:0' }, { ...fee, remaining: 0 }, { ...fee, remaining: 0.49 }, { ...fee, payments: [{ id: 1, amount: 10, status: 'Processing', paymentDate: null }] }]) assert.equal(canPayFee(lease, charge, gate), false);
  assert.equal(canPayFee(lease, fee, { allowed: false, blockers: [] }), false);
  assert.equal(canPayFee({ ...lease, isActive: false }, fee, gate), false);
});

test('fee intent sends exact chargeId and cents; legacy rent request omits chargeId', async () => {
  const posts = [];
  const transport = createTenantPaymentsAPI({ get: async () => null, post: async (url, body) => { posts.push(body); return { success: true, data: { clientSecret: 'pi_abc_secret_xyz', paymentIntentId: 'pi_abc' } }; } });
  await transport.createIntent(17, 12.5, uuid, 'fee:41');
  await transport.createIntent(17, 12.5, uuid);
  assert.deepEqual(posts, [{ leaseId: 17, amount: 12.5, operationId: uuid, chargeId: 'fee:41' }, { leaseId: 17, amount: 12.5, operationId: uuid }]);
  for (const id of ['deposit:security:17', 'fee:0', 'fee:abc', 'rent:17']) await assert.rejects(transport.createIntent(17, 12.5, uuid, id), /charge/i);
  await assert.rejects(transport.createIntent(17, 12.501, uuid, 'fee:41'), /amount/i);
  assert.equal(posts.length, 2);
});

test('selected partial fee is revalidated against latest balance and readiness before checkout', async () => {
  const calls = []; const seen = [];
  const result = await submitFeePayment(args({ ...api, createIntent: async (...values) => { calls.push(values); return api.createIntent(); } }, { onIntentCreated: intent => seen.push(intent) }));
  assert.deepEqual(calls, [[17, 12.5, uuid, 'fee:41']]);
  assert.deepEqual(seen, [{ paymentIntentId: 'pi_abc', amount: 12.5, chargeId: 'fee:41', previousRemaining: 75 }]);
  assert.deepEqual(result, { result: 'submitted', amount: 12.5, paymentIntentId: 'pi_abc', chargeId: 'fee:41' });
});

test('changed fee, missing fee, processing fee, denied gate and stale lease never create an intent', async () => {
  let created = 0; const tracked = { ...api, createIntent: async () => { created++; return api.createIntent(); } };
  for (const changes of [
    { charges: async () => [{ ...fee, remaining: 74 }] }, { charges: async () => [] },
    { charges: async () => [{ ...fee, payments: [{ id: 1, status: 'Created', amount: 10, paymentDate: null }] }] },
    { readiness: async () => ({ allowed: false, blockers: [] }) }, { leases: async () => [{ ...lease, isActive: false }] },
  ]) await assert.rejects(submitFeePayment(args({ ...tracked, ...changes })), /refresh|unavailable|changed/i);
  await assert.rejects(submitFeePayment(args(tracked, { isCurrent: () => false })), /changed|refresh/i);
  for (const input of ['0.49', '75.01', '12.501', '-1']) await assert.rejects(submitFeePayment(args(tracked, { input })), /amount/i);
  await assert.rejects(submitFeePayment(args(tracked, { displayedFee: deposit })), /fee|unavailable/i);
  assert.equal(created, 0);
});

test('sheet error retains the fee intent and only matched terminal server history clears its hold', async () => {
  let pending = null;
  await assert.rejects(submitFeePayment(args(api, { onIntentCreated: intent => { pending = intent; }, checkout: async () => { throw Error('sheet failure'); } })), /sheet failure/);
  assert.equal(pendingFeePayment(pending, []), true);
  assert.equal(pendingFeePayment(pending, [{ stripePaymentIntentId: 'pi_abc', status: 'Processing' }]), true);
  assert.equal(pendingFeePayment(pending, [{ stripePaymentIntentId: 'pi_other', status: 'Paid' }]), true);
  assert.equal(pendingFeePayment(pending, [{ stripePaymentIntentId: 'pi_abc', status: 'Paid' }]), false);
  assert.equal(pendingFeePayment(pending, [{ stripePaymentIntentId: 'pi_abc', status: 'Failed' }]), false);
});

test('confirmed fee ledger reduction clears local hold only after full submitted amount is credited', () => {
  const pending = { paymentIntentId: 'pi_abc', chargeId: 'fee:41', amount: 12.5, previousRemaining: 75 };
  assert.equal(pendingFeePayment(pending, [], { ...fee, remaining: 75 }), true);
  assert.equal(pendingFeePayment(pending, [], { ...fee, remaining: 70 }), true);
  assert.equal(pendingFeePayment(pending, [], { ...fee, remaining: 62.5 }), false);
  assert.equal(pendingFeePayment(pending, [], { ...fee, remaining: 62 }), false);
  assert.equal(pendingFeePayment(pending, [], deposit), true);
  assert.equal(pendingFeePayment(pending, [{ status: 'Paid', paymentType: 'Rent', amount: 12.5 }], { ...fee, remaining: 75 }), true);
  assert.equal(pendingFeePayment(pending, [], { ...fee, remaining: Number.NaN }), true);
  assert.equal(pendingFeePayment({ ...pending, previousRemaining: undefined }, [], { ...fee, remaining: 62.5 }), true);
  assert.equal(pendingFeePayment(pending, [], null), true);
});

test('canceled or unconfirmed checkout cannot release the fee hold without authoritative evidence', async () => {
  let pending;
  const result = await submitFeePayment(args(api, { onIntentCreated: intent => { pending = intent; }, checkout: async () => 'canceled' }));
  assert.equal(result.result, 'canceled');
  assert.equal(pendingFeePayment(pending, [{ status: 'Paid', paymentType: 'Rent', amount: 12.5 }], fee), true);
  assert.equal(pendingFeePayment(pending, [], { ...fee, remaining: 75 }), true);
});

test('context change after intent creation never opens the sheet', async () => {
  let active = true, sheets = 0;
  await assert.rejects(submitFeePayment(args({ ...api, createIntent: async () => { active = false; return api.createIntent(); } }, { isCurrent: () => active, checkout: async () => { sheets++; return 'submitted'; } })), /changed|refresh/i);
  assert.equal(sheets, 0);
});

test('native screen wires fee selection, amount, pending hold and submitted-not-paid copy while deposit stays read-only', () => {
  const screen = readFileSync(new URL('../src/screens/tenant/TenantPaymentsScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /submitFeePayment\(/);
  assert.match(screen, /canPayFee\(lease, charge, readiness\)/);
  assert.match(screen, /pendingFeePayment\(intent, payments, chargeResult\.value\.find\(charge => charge\.chargeId === intent\.chargeId\)/);
  assert.match(screen, /feePendingByLeaseRef\.current\[leaseId\] = \{ \.\.\.feePendingByLeaseRef\.current\[leaseId\], \[charge\.chargeId\]: intent \}/);
  assert.match(screen, /selectedRef\.current === id\s*\? Object\.fromEntries/);
  assert.match(screen, /if \(chargeResult\.error === ''\) \{/);
  assert.match(screen, /feePendingByLeaseRef/);
  assert.match(screen, /accessibilityLabel="Fee payment amount in dollars"/);
  assert.match(screen, /Pay .* toward .*fee/);
  assert.match(screen, /submitted · processing until server confirmation/);
  assert.match(screen, /Deposits cannot be paid online/);
  assert.match(screen, /submitRentPayment\(/);
});
