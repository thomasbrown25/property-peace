import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLegacyOnlinePaymentsRedirect, DEFAULT_ONLINE_PAYMENT_TAB, getOnlinePaymentTabs, getRequestedOnlinePaymentTab,
  getSelectedOnlinePaymentTab, isStripeSetupRequested, ONLINE_PAYMENT_SETUP_PATH
} from './onlinePaymentTabs.js';

test('payment setup links open the wizard inside the Stripe tab', () => {
  const url = new URL(ONLINE_PAYMENT_SETUP_PATH, 'https://property-peace.test');
  assert.equal(url.pathname, '/landlord/settings');
  assert.equal(url.searchParams.get('tab'), 'payments');
  assert.equal(DEFAULT_ONLINE_PAYMENT_TAB, 'stripe');
  assert.equal(url.searchParams.get('paymentTab'), 'stripe');
  assert.equal(getRequestedOnlinePaymentTab(url.searchParams), 'stripe');
  assert.equal(isStripeSetupRequested(url.searchParams), true);
});

test('old setup and bank account links keep their destination within Stripe', () => {
  for (const query of ['setup=1', 'paymentTab=setup-stripe']) {
    const params = new URLSearchParams(query);
    assert.equal(getRequestedOnlinePaymentTab(params), 'stripe');
    assert.equal(isStripeSetupRequested(params), true);
  }
  for (const query of ['paymentTab=bank-accounts', 'stripe=connected']) {
    const params = new URLSearchParams(query);
    assert.equal(getRequestedOnlinePaymentTab(params), 'stripe');
    assert.equal(isStripeSetupRequested(params), false);
  }
  const transactions = new URLSearchParams('paymentTab=transactions&setup=1');
  assert.equal(getRequestedOnlinePaymentTab(transactions), 'transactions');
  assert.equal(isStripeSetupRequested(transactions), false);
});

test('Stripe is available without Configure readiness', () => {
  assert.deepEqual(getOnlinePaymentTabs(), [{ id: 'stripe', label: 'Stripe' }]);
  assert.equal(getSelectedOnlinePaymentTab(DEFAULT_ONLINE_PAYMENT_TAB, getOnlinePaymentTabs()), 'stripe');
});

test('legacy links retain their payment subtab and Stripe setup or return parameters', () => {
  assert.equal(buildLegacyOnlinePaymentsRedirect(''), '/landlord/settings?tab=payments');
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=bank-accounts&stripe=connected&setup=1'),
    '/landlord/settings?tab=payments&stripe=connected&setup=1');
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=setup-stripe'), '/landlord/settings?tab=payments&paymentTab=stripe&setup=1');
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=payout-assignments'), '/landlord/settings?tab=payments&paymentTab=payout-assignments');
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=subscription&stripe=refresh'), '/landlord/settings?tab=payments&stripe=refresh');
});

test('Payout Assignments follows Stripe and requires Configure readiness', () => {
  assert.deepEqual(getOnlinePaymentTabs(true).map((tab) => tab.id), ['stripe', 'payout-assignments']);
  assert.equal(getSelectedOnlinePaymentTab('payout-assignments', getOnlinePaymentTabs(true)), 'payout-assignments');
  assert.equal(getSelectedOnlinePaymentTab('payout-assignments', getOnlinePaymentTabs(false)), 'stripe');
});

test('bookmarks to online payment transactions follow the view to Finances', () => {
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=transactions'), '/landlord/finances?tab=payments&paymentView=stripe');
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=payments&paymentTab=transactions'), '/landlord/finances?tab=payments&paymentView=stripe');
  assert.equal(getSelectedOnlinePaymentTab('transactions', getOnlinePaymentTabs(true)), 'stripe');
});

test('Stripe selection is stable while readiness refreshes', () => {
  for (const allowed of [false, true, false]) assert.equal(getSelectedOnlinePaymentTab('stripe', getOnlinePaymentTabs(allowed)), 'stripe');
});
