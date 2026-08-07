import useSWR from 'swr';
import { useCallback } from 'react';

import { getLeasingPipeline } from 'api/leasingPipeline';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import { buildLeasingPipelineKey } from 'utils/leasingPipeline';

export default function useLeasingPipeline(resourceType, resourceId, unitId) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const userKey = user?.id ?? user?.Id;
  const organizationKey = currentOrganization?.id ?? currentOrganization?.Id ?? user?.organizationId ?? user?.OrganizationId;
  const numericResourceId = Number(resourceId);
  const numericUnitId = unitId == null || unitId === '' ? null : Number(unitId);
  const cacheKey = buildLeasingPipelineKey({
    userId: userKey,
    organizationId: organizationKey,
    resourceType,
    resourceId: numericResourceId,
    unitId: numericUnitId
  });

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    () => getLeasingPipeline(resourceType, numericResourceId, numericUnitId),
    { keepPreviousData: false, shouldRetryOnError: false, revalidateOnFocus: true }
  );
  const retry = useCallback(() => mutate(), [mutate]);
  const revalidate = useCallback(async () => {
    await mutate(undefined, { revalidate: false });
    return mutate(undefined, { revalidate: true });
  }, [mutate]);

  return {
    pipeline: error ? undefined : data,
    error,
    isLoading: Boolean(cacheKey) && isLoading,
    retry,
    revalidate,
    canLoad: Boolean(cacheKey)
  };
}
