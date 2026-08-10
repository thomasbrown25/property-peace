import axiosServices from 'utils/axios';

export async function fetchActivation(organizationId, signal) {
  const response = await axiosServices.get('/api/activation', {
    signal,
    headers: { 'X-Organization-ID': organizationId }
  });
  return response?.data?.data ?? response?.data;
}

export const activationAPI = { get: fetchActivation };
