import axiosServices from 'utils/axios';

export const getFeatureReadiness = async () => {
  const response = await axiosServices.get('/api/feature-readiness');
  return Array.isArray(response?.data) ? response.data : [];
};
