import { ONLINE_PAYMENT_SETUP_PATH } from '../../../utils/onlinePaymentTabs.js';
import { canManageStripeAccount } from '../../../utils/stripeOrganizationRequestLifecycle.js';

export const ONLINE_PAYMENT_TODO_ID = 'online-payments';

export function canSetUpOnlinePayments(status) {
  if (status?.detailsSubmitted !== false || status.isEnabled === true) return false;
  return status.accountId === null || status.accountId === '' || (Boolean(status.accountId) && canManageStripeAccount(status));
}

export function getOwnerSetupTodos(paymentAccountStatus, rentPaymentAccess) {
  const todos = [];
  const { presentation, loading, error, readinessError } = rentPaymentAccess;
  if (
    canSetUpOnlinePayments(paymentAccountStatus) &&
    !loading &&
    !error &&
    !readinessError &&
    presentation?.canConfigure === true &&
    presentation.canPay !== true
  ) {
    todos.push({
      id: ONLINE_PAYMENT_TODO_ID,
      title: 'Set up online payments',
      actionLabel: paymentAccountStatus.accountId ? 'Continue Stripe setup' : 'Set up Stripe',
      href: ONLINE_PAYMENT_SETUP_PATH
    });
  }
  return todos;
}

const getDismissalKey = (scope, todoId) => `propertyPeace:owner-setup-todo:${scope}:${todoId}`;

export function isOwnerSetupTodoDismissed(scope, todoId, storage) {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(getDismissalKey(scope, todoId)) === 'true';
  } catch {
    return false;
  }
}

export function dismissOwnerSetupTodo(scope, todoId, storage) {
  try {
    (storage ?? globalThis.localStorage)?.setItem(getDismissalKey(scope, todoId), 'true');
  } catch {
    // The currently mounted list still hides the todo when storage is unavailable.
  }
}
