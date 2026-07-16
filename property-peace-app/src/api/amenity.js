import axiosServices from 'utils/axios';

const amenityApi = {
  getBasicAmenities: async () => {
    const response = await axiosServices.get('/api/amenity/basic');
    return response.data;
  },

  getDefaultAmenities: async (category = null) => {
    const url = category ? `/api/amenity/default?category=${category}` : '/api/amenity/default';
    const response = await axiosServices.get(url);
    return response.data;
  },

  getCustomAmenities: async () => {
    const response = await axiosServices.get('/api/amenity/custom');
    return response.data;
  },

  createCustomAmenity: async (amenityData) => {
    const response = await axiosServices.post('/api/amenity/custom', amenityData);
    return response.data;
  },

  deleteCustomAmenity: async (id) => {
    const response = await axiosServices.delete(`/api/amenity/custom/${id}`);
    return response.data;
  },
};

export default amenityApi;
