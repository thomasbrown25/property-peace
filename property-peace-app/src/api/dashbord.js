import useSWR, { mutate } from 'swr';
import { useMemo } from 'react';
import axios from 'axios';

import { fetcher } from 'utils/axios';

export const dashboardEndpoints = {
  key: 'api/dashboard', // base cache prefix
  summary: (landlordId) => `/${landlordId}/summary`
};

/**
 * Fetch dashboard summary for a landlord.
 * Expects server response like: { success, data: Dashboard[], ... }
 */
export function useGetDashboard(landlordId) {
  const key = landlordId ? dashboardEndpoints.key + dashboardEndpoints.summary(landlordId) : null; // null disables SWR until landlordId exists

  const { data, error, isLoading, isValidating } = useSWR(key, fetcher, {
    revalidateIfStale: true, // consider true so background refresh can happen
    revalidateOnFocus: false, // tune to your preference
    revalidateOnReconnect: true
  });

  const dashboard = data?.data ?? []; // API nests objects under data

  return useMemo(
    () => ({
      dashboard,
      dashboardLoading: isLoading,
      dashboardError: error,
      dashboardValidating: isValidating,
      dashboardEmpty: !isLoading && dashboard.length === 0
    }),
    [dashboard, isLoading, error, isValidating]
  );
}

/**
 * Optional: SWR-backed UI state for a dashboard modal
 */
const dashboardUiKey = dashboardEndpoints.key + '/ui';

export function useDashboardUi() {
  const { data } = useSWR(dashboardUiKey, () => ({ modalOpen: false, editingId: null }), {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });
  return data;
}

export function setDashboardModal(open, editingId = null) {
  mutate(dashboardUiKey, (curr) => ({ ...(curr ?? {}), modalOpen: open, editingId }), false);
}
