import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_ONLINE_PAYMENT_TAB, getOnlinePaymentTabs, getSelectedOnlinePaymentTab } from './onlinePaymentTabs.js';

test('only Bank Accounts is available until access is approved and Configure is allowed', () => {
  assert.deepEqual(
    getOnlinePaymentTabs({ status: 'Pending' }).map((tab) => tab.id),
    ['bank-accounts']
  );
  assert.deepEqual(
    getOnlinePaymentTabs({ Status: 'NotRequested' }).map((tab) => tab.id),
    ['bank-accounts']
  );
});

test('Payout Assignments remains hidden until Configure access is allowed', () => {
  assert.deepEqual(
    getOnlinePaymentTabs({ status: 'Approved' }).map((tab) => tab.id),
    ['transactions', 'bank-accounts']
  );
  assert.deepEqual(
    getOnlinePaymentTabs({ Status: 'approved' }, true).map((tab) => tab.id),
    ['transactions', 'bank-accounts', 'payout-assignments']
  );
});

test('Bank Accounts remains selected when approved access arrives after the initial render', () => {
  const activeTab = 'bank-accounts';
  const loadingTabs = getOnlinePaymentTabs(null);
  const approvedTabs = getOnlinePaymentTabs({ status: 'Approved' }, true);

  assert.equal(getSelectedOnlinePaymentTab(activeTab, loadingTabs), 'bank-accounts');
  assert.equal(getSelectedOnlinePaymentTab(activeTab, approvedTabs), 'bank-accounts');
});

test('approved access opens Payment Transactions by default after access finishes loading', () => {
  const loadingTabs = getOnlinePaymentTabs(null);
  const approvedTabs = getOnlinePaymentTabs({ status: 'Approved' }, true);

  assert.equal(getSelectedOnlinePaymentTab(DEFAULT_ONLINE_PAYMENT_TAB, loadingTabs), 'bank-accounts');
  assert.equal(getSelectedOnlinePaymentTab(DEFAULT_ONLINE_PAYMENT_TAB, approvedTabs), 'transactions');
});

test('a stale Payout Assignments selection fails closed when Configure access is unavailable', () => {
  const paymentTabs = getOnlinePaymentTabs({ status: 'Approved' }, false);

  assert.equal(getSelectedOnlinePaymentTab('payout-assignments', paymentTabs), 'bank-accounts');
});
