import useSWR from 'swr';

import { getFeatureReadiness } from 'api/featureReadiness';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import { findFeatureReadiness, getFeaturePresentation } from 'utils/featureReadiness';

export function useFeatureReadiness(feature) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const userKey = user?.id ?? user?.Id ?? user?.email ?? user?.Email;
  const organizationKey = currentOrganization?.id ?? currentOrganization?.Id ?? 'tenant';
  const cacheKey = userKey ? ['/api/feature-readiness', userKey, organizationKey] : null;
  const { data, error, isLoading, mutate } = useSWR(cacheKey, () => getFeatureReadiness(), {
    revalidateOnFocus: true,
    shouldRetryOnError: false
  });
  const readiness = findFeatureReadiness(data, feature);
  const presentation = getFeaturePresentation(readiness, { isLoading, error });
  return { readiness, presentation, canInvoke: presentation.canInvoke, isLoading, error, refresh: mutate };
}

export default useFeatureReadiness;
