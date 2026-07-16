import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getDashboardSummary } from 'store/dashboard/dashboard.action';
import { selectDashboardSummary } from 'store/dashboard/dashboard.selector';
import useAuth from './useAuth';

export default function useFetchDashboardSummary() {
  const dispatch = useDispatch();
  const { user, isLoggedIn } = useAuth();
  const dashboardSummary = useSelector(selectDashboardSummary);

  const refetchDashboardSummary = useCallback(() => {
    // OrganizationId is sent via X-Organization-Id header
    const action = getDashboardSummary();

    const result = dispatch(action);
    // If you're using RTK createAsyncThunk, unwrap will exist:
    return typeof result.unwrap === 'function' ? result.unwrap() : result;
  }, [dispatch]);

  useEffect(() => {
    // Wait for user to be available after login
    if (isLoggedIn && user?.id) {
      refetchDashboardSummary();
    }
  }, [isLoggedIn, user?.id, refetchDashboardSummary]);

  return { dashboardSummary, refetchDashboardSummary };
}
