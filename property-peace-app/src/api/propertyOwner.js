import axiosServices from '../utils/axios';

const propertyOwnerAPI = {
  getAll: async () => {
    const response = await axiosServices.get('/api/property-owner');
    return response.data;
  },

  getById: async (id) => {
    const response = await axiosServices.get(`/api/property-owner/${id}`);
    return response.data;
  },

  create: async (owner) => {
    const response = await axiosServices.post('/api/property-owner', owner);
    return response.data;
  },

  update: async (id, owner) => {
    const response = await axiosServices.put(`/api/property-owner/${id}`, owner);
    return response.data;
  },

  delete: async (id) => {
    const response = await axiosServices.delete(`/api/property-owner/${id}`);
    return response.data;
  },

  linkProperty: async (ownerId, propertyId) => {
    const response = await axiosServices.post(`/api/property-owner/${ownerId}/link-property/${propertyId}`);
    return response.data;
  },

  unlinkProperty: async (ownerId, propertyId) => {
    const response = await axiosServices.post(`/api/property-owner/${ownerId}/unlink-property/${propertyId}`);
    return response.data;
  }
};

export default propertyOwnerAPI;
