const tabs = Object.freeze({
  transactions: Object.freeze({ id: 'transactions', label: 'Payment Transactions' }),
  bankAccounts: Object.freeze({ id: 'bank-accounts', label: 'Bank Accounts' }),
  payoutAssignments: Object.freeze({ id: 'payout-assignments', label: 'Payout Assignments' })
});

export const DEFAULT_ONLINE_PAYMENT_TAB = tabs.transactions.id;

export function getOnlinePaymentTabs(canConfigure = false) {
  const setupTabs = canConfigure ? [tabs.bankAccounts, tabs.payoutAssignments] : [tabs.bankAccounts];
  return [tabs.transactions, ...setupTabs];
}

export function getSelectedOnlinePaymentTab(activeTab, paymentTabs) {
  return paymentTabs.some(({ id }) => id === activeTab) ? activeTab : tabs.bankAccounts.id;
}
