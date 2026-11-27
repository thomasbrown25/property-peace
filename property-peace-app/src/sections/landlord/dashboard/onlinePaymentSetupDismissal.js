import { clearOnlinePaymentSetupDismissal, wasOnlinePaymentSetupDismissed } from './ownerSetupTodoModel.js';

export const ONLINE_PAYMENT_DISMISSAL_PATH = '/api/dashboard/online-payments-setup-dismissal';

const requestConfig = (organizationId, signal) => ({
  signal,
  headers: { 'X-Organization-Id': String(organizationId) }
});

export async function loadOnlinePaymentSetupDismissal({ scope, organizationId, signal, get, put, storage }) {
  const config = requestConfig(organizationId, signal);

  if (wasOnlinePaymentSetupDismissed(scope, storage)) {
    await put(ONLINE_PAYMENT_DISMISSAL_PATH, undefined, config);
    clearOnlinePaymentSetupDismissal(scope, storage);
    return true;
  }

  const response = await get(ONLINE_PAYMENT_DISMISSAL_PATH, config);
  if (typeof response.data?.dismissed !== 'boolean') throw new Error('Online payments setup dismissal response was invalid.');
  return response.data.dismissed;
}

export function saveOnlinePaymentSetupDismissal({ organizationId, signal, put }) {
  return put(ONLINE_PAYMENT_DISMISSAL_PATH, undefined, requestConfig(organizationId, signal));
}
