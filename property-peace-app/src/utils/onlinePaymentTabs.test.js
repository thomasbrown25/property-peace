import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ONLINE_PAYMENT_TAB, getOnlinePaymentTabs, getSelectedOnlinePaymentTab } from './onlinePaymentTabs.js';

test('transaction history and bank accounts are available without an approval record', () => {
  assert.deepEqual(getOnlinePaymentTabs().map((tab) => tab.id), ['transactions', 'bank-accounts']);
  assert.equal(getSelectedOnlinePaymentTab(DEFAULT_ONLINE_PAYMENT_TAB, getOnlinePaymentTabs()), 'transactions');
});

test('Payout Assignments still requires authorized Configure readiness', () => {
  assert.deepEqual(getOnlinePaymentTabs(true).map((tab) => tab.id), ['transactions', 'bank-accounts', 'payout-assignments']);
  assert.equal(getSelectedOnlinePaymentTab('payout-assignments', getOnlinePaymentTabs(false)), 'bank-accounts');
});

test('Bank Accounts selection is stable while readiness refreshes', () => {
  for (const allowed of [false, true, false]) assert.equal(getSelectedOnlinePaymentTab('bank-accounts', getOnlinePaymentTabs(allowed)), 'bank-accounts');
});
