import axiosServices from 'utils/axios';

const featureApi = {
  getDefaultFeatures: async () => {
    const response = await axiosServices.get('/api/feature/default');
    return response.data;
  },

  getCustomFeatures: async () => {
    const response = await axiosServices.get('/api/feature/custom');
    return response.data;
  },

  createCustomFeature: async (payload) => {
    const response = await axiosServices.post('/api/feature/custom', payload);
    return response.data;
  },

  deleteCustomFeature: async (id) => {
    const response = await axiosServices.delete(`/api/feature/custom/${id}`);
    return response.data;
  },
};

export default featureApi;
