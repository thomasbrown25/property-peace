import { useEffect, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllTenants } from 'store/tenant/tenant.action';
import { selectTenants, selectTenantsLoadedAt } from 'store/tenant/tenant.selector';
import useAuth from './useAuth';

const STALE_MS = 5 * 60 * 1000; // 5 minutes

export default function useFetchTenants() {
  const dispatch = useDispatch();
  const { user, isLoggedIn } = useAuth();
  const tenants = useSelector(selectTenants);
  const loadedAt = useSelector(selectTenantsLoadedAt);
  const [isLoading, setIsLoading] = useState(false);

  // force-refetch regardless of stale time (used after mutations)
  const refetch = useCallback(() => {
    if (!user?.id) return;
    setIsLoading(true);
    dispatch(getAllTenants()).finally(() => setIsLoading(false));
  }, [dispatch, user?.id]);

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;
    if (loadedAt && Date.now() - loadedAt < STALE_MS) return;
    refetch();
  }, [isLoggedIn, user?.id, loadedAt, refetch]);

  return { tenants, refetch, isLoading };
}
