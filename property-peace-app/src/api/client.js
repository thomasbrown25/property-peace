import axiosServices from 'utils/axios';

export const clientAPI = {
  /**
   * Get all clients for the current organization
   */
  getAll: async () => {
    const response = await axiosServices.get('/api/client');
    return response.data;
  },

  /**
   * Get a single client by ID
   */
  getById: async (id) => {
    const response = await axiosServices.get(`/api/client/${id}`);
    return response.data;
  },

  /**
   * Create a new client
   */
  create: async (data) => {
    const response = await axiosServices.post('/api/client', data);
    return response.data;
  },

  /**
   * Update an existing client
   */
  update: async (id, data) => {
    const response = await axiosServices.put(`/api/client/${id}`, data);
    return response.data;
  },

  /**
   * Delete a client
   */
  delete: async (id) => {
    const response = await axiosServices.delete(`/api/client/${id}`);
    return response.data;
  },

  /**
   * Link a property to a client
   */
  linkProperty: async (clientId, propertyId) => {
    const response = await axiosServices.post(`/api/client/${clientId}/link-property/${propertyId}`);
    return response.data;
  },

  /**
   * Unlink a property from a client
   */
  unlinkProperty: async (clientId, propertyId) => {
    const response = await axiosServices.post(`/api/client/${clientId}/unlink-property/${propertyId}`);
    return response.data;
  },

  /**
   * Resend invite email to a client
   */
  resendInvite: async (clientId) => {
    const response = await axiosServices.post(`/api/client/${clientId}/resend-invite`);
    return response.data;
  },

  /**
   * Validate a client invite token
   */
  validateInviteToken: async (token) => {
    const response = await axiosServices.get(`/api/client/invite/validate/${token}`);
    return response.data;
  }
};
