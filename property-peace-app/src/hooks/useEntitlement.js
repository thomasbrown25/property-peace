import useSWR from 'swr';

import { getEntitlement } from 'api/entitlements';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import {
  buildEntitlementCacheKey,
  deriveEntitlementState,
  normalizeEntitlementDecision
} from 'utils/entitlements';

export default function useEntitlement(feature) {
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const { user } = useAuth();
  const subject = user?.id ?? user?.Id ?? user?.sub ?? user?.email ?? user?.Email;
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id;
  const cacheKey = buildEntitlementCacheKey({ feature, subject, organizationId });
  const serializedCacheKey = cacheKey ? JSON.stringify(cacheKey) : null;

  const { data, error, isLoading: requestLoading, isValidating, mutate } = useSWR(
    cacheKey,
    async () => ({ cacheKey: serializedCacheKey, payload: await getEntitlement(feature) }),
    {
      keepPreviousData: false,
      revalidateOnFocus: true,
      shouldRetryOnError: false
    }
  );

  const responseBelongsToScope = Boolean(serializedCacheKey && data && data.cacheKey === serializedCacheKey);
  let decision = responseBelongsToScope ? normalizeEntitlementDecision(data.payload, feature) : null;

  if (!organizationLoading && !cacheKey) {
    decision = normalizeEntitlementDecision({
      isAllowed: false,
      matrixVersion: 'client-context-v1',
      featureKey: feature,
      effectivePlan: null,
      category: subject ? 'setup' : 'unauthorized',
      reasonCode: subject ? 'organization-required' : 'authentication-required',
      quota: null,
      requiredAddOns: [],
      readinessDependencies: []
    }, feature);
  }

  const { isLoading, presentation } = deriveEntitlementState(decision, {
    organizationLoading,
    hasCacheKey: Boolean(cacheKey),
    requestLoading,
    isValidating,
    error
  });
  const refresh = () => mutate();
  return {
    decision,
    presentation,
    canInvoke: presentation.canInvoke,
    isLoading,
    error,
    refresh
  };
}
