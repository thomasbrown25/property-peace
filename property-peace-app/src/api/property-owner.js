import axiosServices from 'utils/axios';

export const propertyOwnerAPI = {
  /**
   * Get all property owners for the current organization
   */
  getAll: async () => {
    const response = await axiosServices.get('/api/propertyowner');
    return response.data;
  },

  /**
   * Get a single property owner by ID
   */
  getById: async (id) => {
    const response = await axiosServices.get(`/api/propertyowner/${id}`);
    return response.data;
  },

  /**
   * Create a new property owner
   */
  create: async (data) => {
    const response = await axiosServices.post('/api/propertyowner', data);
    return response.data;
  },

  /**
   * Update an existing property owner
   */
  update: async (id, data) => {
    const response = await axiosServices.put(`/api/propertyowner/${id}`, data);
    return response.data;
  },

  /**
   * Delete a property owner
   */
  delete: async (id) => {
    const response = await axiosServices.delete(`/api/propertyowner/${id}`);
    return response.data;
  },

  /**
   * Link a property to an owner
   */
  linkProperty: async (ownerId, propertyId) => {
    const response = await axiosServices.post(`/api/propertyowner/${ownerId}/link-property/${propertyId}`);
    return response.data;
  },

  /**
   * Unlink a property from an owner
   */
  unlinkProperty: async (ownerId, propertyId) => {
    const response = await axiosServices.post(`/api/propertyowner/${ownerId}/unlink-property/${propertyId}`);
    return response.data;
  }
};
