import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLegacyOnlinePaymentsRedirect, DEFAULT_ONLINE_PAYMENT_TAB, getOnlinePaymentTabs, getSelectedOnlinePaymentTab, ONLINE_PAYMENT_SETUP_PATH
} from './onlinePaymentTabs.js';

test('payment setup links select the Bank Accounts tab and request the wizard', () => {
  const url = new URL(ONLINE_PAYMENT_SETUP_PATH, 'https://property-peace.test');
  assert.equal(url.pathname, '/landlord/settings');
  assert.equal(url.searchParams.get('tab'), 'payments');
  assert.equal(DEFAULT_ONLINE_PAYMENT_TAB, 'bank-accounts');
  assert.equal(url.searchParams.get('setup'), '1');
});

test('Bank Accounts is available without Configure readiness', () => {
  assert.deepEqual(getOnlinePaymentTabs().map((tab) => tab.id), ['bank-accounts']);
  assert.equal(getSelectedOnlinePaymentTab(DEFAULT_ONLINE_PAYMENT_TAB, getOnlinePaymentTabs()), 'bank-accounts');
});

test('legacy links retain their payment subtab and Stripe setup or return parameters', () => {
  assert.equal(buildLegacyOnlinePaymentsRedirect(''), '/landlord/settings?tab=payments');
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=bank-accounts&stripe=connected&setup=1'),
    '/landlord/settings?tab=payments&stripe=connected&setup=1');
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=payout-assignments'), '/landlord/settings?tab=payments&paymentTab=payout-assignments');
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=subscription&stripe=refresh'), '/landlord/settings?tab=payments&stripe=refresh');
});

test('Payout Assignments still requires authorized Configure readiness', () => {
  assert.deepEqual(getOnlinePaymentTabs(true).map((tab) => tab.id), ['bank-accounts', 'payout-assignments']);
  assert.equal(getSelectedOnlinePaymentTab('payout-assignments', getOnlinePaymentTabs(false)), 'bank-accounts');
});

test('bookmarks to online payment transactions follow the view to Finances', () => {
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=transactions'), '/landlord/finances?tab=payments&paymentView=stripe');
  assert.equal(buildLegacyOnlinePaymentsRedirect('?tab=payments&paymentTab=transactions'), '/landlord/finances?tab=payments&paymentView=stripe');
  assert.equal(getSelectedOnlinePaymentTab('transactions', getOnlinePaymentTabs(true)), 'bank-accounts');
});

test('Bank Accounts selection is stable while readiness refreshes', () => {
  for (const allowed of [false, true, false]) assert.equal(getSelectedOnlinePaymentTab('bank-accounts', getOnlinePaymentTabs(allowed)), 'bank-accounts');
});
