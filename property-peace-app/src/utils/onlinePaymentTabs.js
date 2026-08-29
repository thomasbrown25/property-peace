const tabs = Object.freeze({
  transactions: Object.freeze({ id: 'transactions', label: 'Payment Transactions' }),
  bankAccounts: Object.freeze({ id: 'bank-accounts', label: 'Bank Accounts' }),
  payoutAssignments: Object.freeze({ id: 'payout-assignments', label: 'Payout Assignments' })
});

const normalizeStatus = (access) =>
  String(access?.status ?? access?.Status ?? '')
    .replace(/[ _-]/g, '')
    .toLowerCase();

export const isRentPaymentAccessApproved = (access) => normalizeStatus(access) === 'approved';

export function getOnlinePaymentTabs(access, canConfigure = false) {
  const setupTabs = canConfigure ? [tabs.bankAccounts, tabs.payoutAssignments] : [tabs.bankAccounts];
  return isRentPaymentAccessApproved(access) ? [tabs.transactions, ...setupTabs] : setupTabs;
}

export function getSelectedOnlinePaymentTab(activeTab, paymentTabs) {
  return paymentTabs.some(({ id }) => id === activeTab) ? activeTab : tabs.bankAccounts.id;
}
