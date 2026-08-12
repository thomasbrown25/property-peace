import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getProperties } from 'store/property/property.action';
import { selectProperties, selectPropertiesLoadedAt } from 'store/property/property.selector';
import useAuth from './useAuth';

const STALE_MS = 5 * 60 * 1000; // 5 minutes

export default function useFetchProperties() {
  const dispatch = useDispatch();
  const { user, isLoggedIn } = useAuth();
  const properties = useSelector(selectProperties);
  const loadedAt = useSelector(selectPropertiesLoadedAt);
  const [isLoading, setIsLoading] = useState(false);
  const [propertiesError, setPropertiesError] = useState(false);

  const propertiesRefetch = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      setPropertiesError(false);
      // OrganizationId is sent via X-Organization-Id header
      const result = await dispatch(getProperties());
      if (result?.success === false) setPropertiesError(true);
    } catch (err) {
      console.error('Failed to fetch properties:', err);
      setPropertiesError(true);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, user?.id]);

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;
    if (loadedAt && Date.now() - loadedAt < STALE_MS) return;
    propertiesRefetch();
  }, [isLoggedIn, user?.id, loadedAt, propertiesRefetch]);

  return { properties, propertiesRefetch, isLoading, propertiesError, propertiesLoadedAt: loadedAt };
}
