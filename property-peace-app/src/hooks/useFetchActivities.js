import useSWR from 'swr';
import { useMemo } from 'react';
import { fetcher } from 'utils/axios';
import useAuth from 'hooks/useAuth';

const endpoints = {
  key: 'api/activities',
  list: (filters) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.activityTypes && filters.activityTypes.length > 0) {
      filters.activityTypes.forEach(type => params.append('activityTypes', type));
    }
    if (filters?.propertyId) params.append('propertyId', filters.propertyId);
    if (filters?.page) params.append('page', filters.page);
    if (filters?.pageSize) params.append('pageSize', filters.pageSize);
    
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }
};

/**
 * Fetch activities for the current user
 * Expects server response: { success: true, data: { activities: [], totalCount: number, page: number, pageSize: number, hasMore: boolean } }
 */
export default function useFetchActivities(filters = {}) {
  const { user } = useAuth();
  const userId = user?.id;

  const filterParams = useMemo(() => {
    return {
      startDate: filters.startDate,
      endDate: filters.endDate,
      activityTypes: filters.activityTypes,
      propertyId: filters.propertyId,
      page: filters.page || 1,
      pageSize: filters.pageSize || 50
    };
  }, [filters.startDate, filters.endDate, filters.activityTypes, filters.propertyId, filters.page, filters.pageSize]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    userId ? `${endpoints.key}${endpoints.list(filterParams)}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 30000 // Poll every 30 seconds for new activities
    }
  );

  const activities = data?.data?.activities || data?.activities || [];
  const totalCount = data?.data?.totalCount || data?.totalCount || 0;
  const page = data?.data?.page || data?.page || 1;
  const pageSize = data?.data?.pageSize || data?.pageSize || 50;
  const hasMore = data?.data?.hasMore || data?.hasMore || false;

  return {
    activities,
    totalCount,
    page,
    pageSize,
    hasMore,
    activitiesLoading: isLoading,
    activitiesError: error,
    activitiesValidating: isValidating,
    refetch: mutate
  };
}

