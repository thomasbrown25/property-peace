import { useSelector } from 'react-redux';
import useSWR from 'swr';
import axiosServices from 'utils/axios';
import { getActiveOrganizationId } from 'utils/impersonationSession';

const fetchPropertyRentCollection = async ([url, organizationId, propertyId]) => {
  const { data } = await axiosServices.get(url, {
    headers: { 'X-Organization-Id': String(organizationId) },
    params: { propertyId, lifetime: false }
  });
  return data.data;
};

export default function usePropertyRentCollection(propertyId) {
  const organizationId = useSelector((state) => getActiveOrganizationId(state.auth?.user));
  const key = organizationId && propertyId ? ['/api/rent-collection', organizationId, String(propertyId)] : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchPropertyRentCollection, { revalidateOnFocus: false });

  return { rentRecords: data?.rentRecords ?? [], error, loading: isLoading, refetch: mutate };
}
