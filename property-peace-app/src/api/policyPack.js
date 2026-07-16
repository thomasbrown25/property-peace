import axiosServices from 'utils/axios';

/**
 * Get default policy pack
 * GET: /api/PolicyPack/default
 */
export const getDefaultPolicyPack = async () => {
  const response = await axiosServices.get('/api/PolicyPack/default');
  return response.data;
};

/**
 * Get all policy packs for organization
 * GET: /api/PolicyPack
 */
export const getPolicyPacks = async () => {
  const response = await axiosServices.get('/api/PolicyPack');
  // Return the full ServiceResponse object, not just the data
  return response.data;
};

/**
 * Get policy pack by ID
 * GET: /api/PolicyPack/{id}
 */
export const getPolicyPack = async (id) => {
  const response = await axiosServices.get(`/api/PolicyPack/${id}`);
  return response.data;
};

/**
 * Get policy pack items
 * GET: /api/PolicyPack/{id}/items
 */
export const getPolicyPackItems = async (id) => {
  const response = await axiosServices.get(`/api/PolicyPack/${id}/items`);
  return response.data?.items || response.data?.Items || [];
};

/**
 * Create policy pack
 * POST: /api/PolicyPack
 */
export const createPolicyPack = async (policyPack) => {
  const response = await axiosServices.post('/api/PolicyPack', policyPack);
  // Return the full ServiceResponse object
  return response.data;
};

/**
 * Update policy pack
 * PUT: /api/PolicyPack/{id}
 */
export const updatePolicyPack = async (id, policyPack) => {
  const response = await axiosServices.put(`/api/PolicyPack/${id}`, policyPack);
  return response.data;
};

/**
 * Delete policy pack
 * DELETE: /api/PolicyPack/{id}
 */
export const deletePolicyPack = async (id) => {
  const response = await axiosServices.delete(`/api/PolicyPack/${id}`);
  return response.data;
};
