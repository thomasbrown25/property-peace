const tabs = Object.freeze({
  bankAccounts: Object.freeze({ id: 'bank-accounts', label: 'Bank Accounts' }),
  payoutAssignments: Object.freeze({ id: 'payout-assignments', label: 'Payout Assignments' })
});

export const DEFAULT_ONLINE_PAYMENT_TAB = tabs.bankAccounts.id;
export const ONLINE_PAYMENT_BANK_ACCOUNTS_PATH = '/landlord/settings?tab=payments';
export const ONLINE_PAYMENT_SETUP_PATH = `${ONLINE_PAYMENT_BANK_ACCOUNTS_PATH}&setup=1`;

export function buildLegacyOnlinePaymentsRedirect(search) {
  const params = new URLSearchParams(search);
  const legacyTab = params.get('tab');
  params.set('tab', 'payments');
  if (legacyTab === 'transactions' || params.get('paymentTab') === 'transactions') {
    params.delete('paymentTab');
    params.set('paymentView', 'stripe');
    return `/landlord/finances?${params}`;
  }
  if (legacyTab === tabs.payoutAssignments.id) {
    params.set('paymentTab', legacyTab);
  }
  return `/landlord/settings?${params}`;
}

export function getOnlinePaymentTabs(canConfigure = false) {
  return canConfigure ? [tabs.bankAccounts, tabs.payoutAssignments] : [tabs.bankAccounts];
}

export function getSelectedOnlinePaymentTab(activeTab, paymentTabs) {
  return paymentTabs.some(({ id }) => id === activeTab) ? activeTab : tabs.bankAccounts.id;
}
