const STORAGE_PREFIX = 'propertyPeace:online-payments-continued';

const readUserId = (user) => user?.id ?? user?.Id;
const readOrganizationId = (user, organization) =>
  organization?.id ??
  organization?.Id ??
  user?.currentOrganizationId ??
  user?.CurrentOrganizationId ??
  user?.organizationId ??
  user?.OrganizationId;

export function getOnlinePaymentsWelcomeStorageKey(user, organization = null) {
  const userId = readUserId(user);
  const organizationId = readOrganizationId(user, organization);

  if (!userId || !organizationId) return null;
  return `${STORAGE_PREFIX}:${organizationId}:${userId}`;
}

export function hasContinuedToOnlinePayments(user, organization = null, storage = globalThis.localStorage) {
  const key = getOnlinePaymentsWelcomeStorageKey(user, organization);
  if (!key || !storage) return false;

  try {
    return storage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function markOnlinePaymentsContinued(user, organization = null, storage = globalThis.localStorage) {
  const key = getOnlinePaymentsWelcomeStorageKey(user, organization);
  if (!key || !storage) return false;

  try {
    storage.setItem(key, 'true');
    return true;
  } catch {
    return false;
  }
}
