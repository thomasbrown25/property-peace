import useSWR from 'swr';

import { getRentPaymentActionReadiness } from 'api/rentPaymentAccess';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';

const blocked = (title, message, severity = 'warning') => ({ status: 'unavailable', title, message, severity, canInvoke: false });

export default function useRentPaymentActionReadiness(action, enabled = true) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const userKey = user?.id ?? user?.Id ?? user?.email ?? user?.Email;
  const organizationKey = currentOrganization?.id ?? currentOrganization?.Id ?? 'current';
  const cacheKey = enabled && userKey && action ? ['/api/feature-readiness/rent-payments', action, userKey, organizationKey] : null;
  const { data, error, isLoading, mutate } = useSWR(cacheKey, async () => (await getRentPaymentActionReadiness(action)).data, {
    revalidateOnFocus: true,
    shouldRetryOnError: false
  });

  const readiness = data ?? null;
  const canInvoke = readiness?.allowed === true;
  const presentation = isLoading
    ? blocked('Checking availability', 'Checking whether online rent payments are available…', 'info')
    : error
      ? blocked('Availability could not be verified', 'Online rent payments are disabled until availability can be verified.', 'error')
      : canInvoke
        ? { status: 'available', title: 'Available', message: 'Online rent payments are ready.', severity: 'success', canInvoke: true }
        : blocked('Payments unavailable', 'Online rent payments are not available for this lease right now. Your payment history is still available.');

  return { readiness, presentation, canInvoke, isLoading, error, refresh: mutate };
}