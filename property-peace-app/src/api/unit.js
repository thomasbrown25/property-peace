import useSWR from 'swr';
import { fetcher, fetcherPost } from 'utils/axios';

const endpoints = {
  key: 'api/lease', // base cache prefix
  list: (landlordId) => `/${landlordId}/list`,
  create: '/', // POST
  update: (id) => `/lease/${id}`, // PUT/PATCH
  remove: (id) => `/lease/${id}` // DELETE
};

export function useGetUnits(propertyId) {
  const key = propertyId ? `/api/lease/active/${propertyId}` : null;
  const { data, error, isLoading } = useSWR(key, fetcher, { revalidateOnFocus: false });

  return {
    activeLease: data?.data ?? data ?? null,
    activeLeaseLoading: isLoading,
    activeLeaseError: error
  };
}

export async function addUnit(payload) {
  const res = await fetcherPost('/api/unit', { arg: payload });
  const created = res?.data?.data ?? res?.data;

  // refresh (or set) the active lease cache so dashboard reflects it immediately
  // if (payload?.PropertyId) {
  //   await mutate(leaseEndpoints.active(payload.PropertyId)); // revalidate from server
  //   // OR: set immediately without refetch:
  //   // mutate(leaseEndpoints.active(dto.PropertyId), created, false);
  // }

  return created;
}
