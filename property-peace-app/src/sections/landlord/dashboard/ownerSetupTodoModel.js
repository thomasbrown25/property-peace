import { ONLINE_PAYMENT_SETUP_PATH } from '../../../utils/onlinePaymentTabs.js';
import { canManageStripeAccount } from '../../../utils/stripeOrganizationRequestLifecycle.js';

export const ONLINE_PAYMENT_TODO_ID = 'online-payments';

const addPropertyTodo = {
  id: 'add-property',
  image: new URL('../../../assets/images/icons/add-property.png', import.meta.url).href,
  title: 'Add a property',
  description: 'Start with an address to organize your rentals in Property Peace.',
  actionLabel: 'Add property',
  href: '/landlord/properties/add'
};

export function canSetUpOnlinePayments(status) {
  if (status?.detailsSubmitted !== false || status.isEnabled === true) return false;
  return status.accountId === null || status.accountId === '' || (Boolean(status.accountId) && canManageStripeAccount(status));
}

export function getOwnerSetupTodos(paymentAccountStatus, rentPaymentAccess, { propertiesStatus, propertyCount, paymentSetupDismissed } = {}) {
  const todos = [];
  if (propertiesStatus === 'ready' && propertyCount === 0) todos.push(addPropertyTodo);

  const { presentation, loading, error, readinessError } = rentPaymentAccess;
  if (
    !paymentSetupDismissed &&
    canSetUpOnlinePayments(paymentAccountStatus) &&
    !loading &&
    !error &&
    !readinessError &&
    presentation?.canConfigure === true &&
    presentation.canPay !== true
  ) {
    todos.push({
      id: ONLINE_PAYMENT_TODO_ID,
      image: new URL('../../../assets/images/icons/setup-online-payments.png', import.meta.url).href,
      title: 'Set up online payments',
      description: 'Give tenants a way to pay rent online.',
      actionLabel: paymentAccountStatus.accountId ? 'Continue Stripe setup' : 'Set up Stripe',
      href: ONLINE_PAYMENT_SETUP_PATH
    });
  }
  return todos;
}

export function getOwnerSetupCompletion({ remainingCount, propertiesStatus, propertyCount, paymentAccountStatus }) {
  const paymentSetupComplete = paymentAccountStatus?.detailsSubmitted === true || paymentAccountStatus?.isEnabled === true;
  const completed = Number(propertiesStatus === 'ready' && propertyCount > 0) + Number(paymentSetupComplete);
  const total = completed + remainingCount;
  return total ? Math.round((completed / total) * 100) : 0;
}

const getOnlinePaymentDismissalKey = (scope) => `propertyPeace:owner-setup-todo:${scope}:${ONLINE_PAYMENT_TODO_ID}`;

export function wasOnlinePaymentSetupDismissed(scope, storage) {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(getOnlinePaymentDismissalKey(scope)) === 'true';
  } catch {
    return false;
  }
}

export function clearOnlinePaymentSetupDismissal(scope, storage) {
  try {
    (storage ?? globalThis.localStorage)?.removeItem(getOnlinePaymentDismissalKey(scope));
  } catch {
    // Server persistence remains the source of truth when browser storage is unavailable.
  }
}
