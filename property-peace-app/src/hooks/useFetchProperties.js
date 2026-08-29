import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getProperties } from 'store/property/property.action';
import { selectProperties, selectPropertiesLoadedAt, selectPropertiesOrganizationId } from 'store/property/property.selector';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from './useAuth';

const STALE_MS = 5 * 60 * 1000; // 5 minutes

export default function useFetchProperties() {
  const dispatch = useDispatch();
  const { user, isLoggedIn } = useAuth();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const properties = useSelector(selectProperties);
  const loadedAt = useSelector(selectPropertiesLoadedAt);
  const loadedOrganizationId = useSelector(selectPropertiesOrganizationId);
  const [isLoading, setIsLoading] = useState(false);
  const [propertiesError, setPropertiesError] = useState(false);

  const propertiesRefetch = useCallback(async () => {
    if (!user?.id || !organizationId) return;
    try {
      setIsLoading(true);
      setPropertiesError(false);
      // OrganizationId is sent via X-Organization-Id header
      const result = await dispatch(getProperties(organizationId));
      if (result?.success === false && !result?.stale) setPropertiesError(true);
    } catch (err) {
      console.error('Failed to fetch properties:', err);
      setPropertiesError(true);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, organizationId, user?.id]);

  useEffect(() => {
    if (!isLoggedIn || !user?.id || !organizationId) return;
    if (loadedOrganizationId === organizationId && loadedAt && Date.now() - loadedAt < STALE_MS) return;
    propertiesRefetch();
  }, [isLoggedIn, user?.id, organizationId, loadedOrganizationId, loadedAt, propertiesRefetch]);

  const visibleProperties = loadedOrganizationId === organizationId ? properties : [];
  return { properties: visibleProperties, propertiesRefetch, isLoading, propertiesError, propertiesLoadedAt: loadedAt };
}
