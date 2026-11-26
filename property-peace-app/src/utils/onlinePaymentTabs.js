const tabs = Object.freeze({
  stripe: Object.freeze({ id: 'stripe', label: 'Stripe' }),
  payoutAssignments: Object.freeze({ id: 'payout-assignments', label: 'Payout Assignments' })
});

export const STRIPE_TAB = tabs.stripe.id;
export const DEFAULT_ONLINE_PAYMENT_TAB = STRIPE_TAB;
export const ONLINE_PAYMENT_STRIPE_PATH = '/landlord/settings?tab=payments';
export const ONLINE_PAYMENT_SETUP_PATH = `${ONLINE_PAYMENT_STRIPE_PATH}&paymentTab=${STRIPE_TAB}&setup=1`;

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
  if (legacyTab === 'setup-stripe') {
    params.set('paymentTab', STRIPE_TAB);
    params.set('setup', '1');
  }
  return `/landlord/settings?${params}`;
}

export function getOnlinePaymentTabs(canConfigure = false) {
  return canConfigure ? [tabs.stripe, tabs.payoutAssignments] : [tabs.stripe];
}

export function getRequestedOnlinePaymentTab(searchParams) {
  const tab = searchParams.get('paymentTab');
  return !tab || tab === 'bank-accounts' || tab === 'setup-stripe' ? STRIPE_TAB : tab;
}

export function isStripeSetupRequested(searchParams) {
  return getRequestedOnlinePaymentTab(searchParams) === STRIPE_TAB &&
    (searchParams.get('setup') === '1' || searchParams.get('paymentTab') === 'setup-stripe');
}

export function getSelectedOnlinePaymentTab(activeTab, paymentTabs) {
  return paymentTabs.some(({ id }) => id === activeTab) ? activeTab : DEFAULT_ONLINE_PAYMENT_TAB;
}
