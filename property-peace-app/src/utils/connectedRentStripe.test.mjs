import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRentStripeLoader, createRentMethodsApi, requireRentStripeAccount, rentMethodUrl } from './connectedRentStripe.mjs';
import { createPaymentIntentSync } from './paymentIntentSync.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const response = (stripeAccountId = 'acct_owner1') => ({ data: { success: true, data: { stripeAccountId, clientSecret: 'pi_secret', paymentIntentId: 'pi_1' } } });

test('rent Stripe loader is account scoped and refuses platform fallback', () => {
  const calls = [];
  const load = createRentStripeLoader((...args) => { calls.push(args); return Promise.resolve(args); });
  assert.equal(load('pk_test_1', 'acct_owner1'), load('pk_test_1', 'acct_owner1'));
  assert.notEqual(load('pk_test_1', 'acct_owner1'), load('pk_test_1', 'acct_owner2'));
  assert.notEqual(load('pk_test_1', 'acct_owner1'), load('pk_test_2', 'acct_owner1'));
  assert.deepEqual(calls[0], ['pk_test_1', { stripeAccount: 'acct_owner1' }]);
  for (const account of [undefined, null, '', 'platform', 'acct_', {}, 1]) assert.throws(() => load('pk_test_1', account));
  assert.throws(() => load('', 'acct_owner1'));
  assert.equal(requireRentStripeAccount('acct_owner1'), 'acct_owner1');
  assert.equal(calls.length, 3);
});

test('rent coordinator fails closed on absent connected account', async () => {
  const states = [];
  const sync = createPaymentIntentSync({ post: async () => response(undefined), onState: (state) => states.push(state) });
  const missing = response(); delete missing.data.data.stripeAccountId;
  const other = createPaymentIntentSync({ post: async () => missing, onState: (state) => states.push(state) });
  const request = { scope: { leaseId: 1, operationId: 'op' }, payload: { leaseId: 1, amount: 1 }, amountCents: 100 };
  other.sync(request);
  await tick();
  assert.equal(other.ready, false);
  assert.equal(states.at(-1).clientSecret, null);
  assert.match(states.at(-1).error.message, /Stripe account is unavailable/);
  sync.dispose();
});

test('rent coordinator retains provenance and rejects changed account on update', async () => {
  const states = []; let calls = 0;
  const sync = createPaymentIntentSync({ post: async () => response(++calls === 1 ? 'acct_owner1' : 'acct_owner2'), onState: (state) => states.push(state) });
  const scope = { leaseId: 1, operationId: 'op' };
  sync.sync({ scope, payload: { leaseId: 1, amount: 1 }, amountCents: 100 });
  await tick();
  assert.equal(sync.ready, true);
  assert.equal(states.at(-1).stripeAccountId, 'acct_owner1');
  sync.sync({ scope, payload: { leaseId: 1, amount: 2 }, amountCents: 200 });
  await tick();
  assert.equal(sync.ready, false);
  assert.match(states.at(-1).error.message, /recipient changed/);
});

test('list, remove and default always carry lease scope and verify returned account', async () => {
  const calls = [];
  const method = { id: 'pm_1', type: 'card', brand: 'visa', last4: '4242', isDefault: true };
  const api = createRentMethodsApi({
    get: async (url) => { calls.push(['GET', url]); return { data: { success: true, data: { stripeAccountId: 'acct_owner1', paymentMethods: [method] } } }; },
    post: async (url) => { calls.push(['POST', url]); return { data: { success: true } }; },
    delete: async (url) => { calls.push(['DELETE', url]); return { data: { success: true } }; }
  });
  assert.deepEqual(await api.list(7, 'acct_owner1'), [method]);
  await api.mutate(7, 'pm_1', 'remove');
  await api.mutate(8, 'pm_2', 'default');
  assert.deepEqual(calls.slice(0, 3), [
    ['GET', '/api/stripe/payment-methods?leaseId=7'],
    ['DELETE', '/api/stripe/payment-methods/pm_1?leaseId=7'],
    ['POST', '/api/stripe/payment-methods/pm_2/default?leaseId=8']
  ]);
  await assert.rejects(api.list(8, 'acct_owner2'), /unavailable for this rent recipient/);
  await assert.rejects(api.mutate(null, 'pm_1', 'remove'), /Select a lease/);
  await assert.rejects(api.mutate(8, 'pm_1', 'bad'), /Invalid/);
  assert.throws(() => rentMethodUrl(''), /Select a lease/);
});

test('saved-method failures do not masquerade as mutation success', async () => {
  const api = createRentMethodsApi({ delete: async () => ({ data: { success: false, message: 'Not owned' } }) });
  await assert.rejects(api.mutate(7, 'pm_1', 'remove'), /Not owned/);
});

test('checkout and setup key Elements by lease, connected account and secret', async () => {
  const checkout = await readFile(new URL('../components/drawers/PaymentModal.jsx', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../pages/tenant/dashboard.jsx', import.meta.url), 'utf8');
  const settings = await readFile(new URL('../sections/landlord/settings/PaymentsSettings.jsx', import.meta.url), 'utf8');
  assert.match(checkout, /key=\{JSON.stringify\(\[scopeKey, stripeAccountId, clientSecret\]\)\}/);
  assert.match(checkout, /rentMethodsApi.list\(rent\?\.leaseId, stripeAccountId\)/);
  assert.match(checkout, /savedMethodId \? \{ payment_method: savedMethodId \}/);
  assert.doesNotMatch(checkout, /loadStripe\(response.data.publishableKey\)/);
  assert.match(dashboard, /create-setup-intent\?leaseId=\$\{encodeURIComponent\(leaseId\)\}/);
  assert.match(dashboard, /key=\{JSON.stringify\(\[leaseId, stripeAccountId, clientSecret\]\)\}/);
  assert.match(dashboard, /key=\{selectedLeaseId\}\s+leaseId=\{selectedLeaseId\}/);
  assert.match(dashboard, /result.setupIntent\?\.status !== 'succeeded'/);
  assert.match(settings, /axiosServices.post\('\/api\/stripe\/account-link', \{\}, \{ signal \}\)/);
  assert.match(settings, /window.open\('https:\/\/dashboard.stripe.com\/'/);
  assert.doesNotMatch(settings, /onClick=\{[^\n]*(?:openEmbeddedOnboarding|openBankAccountManagement)/);
});
