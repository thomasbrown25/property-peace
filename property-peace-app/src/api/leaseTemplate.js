import axiosServices from 'utils/axios';

/**
 * Get default lease template
 * GET: /api/LeaseTemplate/default
 */
export const getDefaultLeaseTemplate = async () => {
  const response = await axiosServices.get('/api/LeaseTemplate/default');
  return response.data;
};

/**
 * Get all lease templates for organization
 * GET: /api/LeaseTemplate
 */
export const getLeaseTemplates = async () => {
  const response = await axiosServices.get('/api/LeaseTemplate');
  return response.data;
};

/**
 * Get lease template by ID
 * GET: /api/LeaseTemplate/{id}
 */
export const getLeaseTemplate = async (id) => {
  const response = await axiosServices.get(`/api/LeaseTemplate/${id}`);
  return response.data;
};

/**
 * Create lease template
 * POST: /api/LeaseTemplate
 */
export const createLeaseTemplate = async (template) => {
  const response = await axiosServices.post('/api/LeaseTemplate', template);
  return response.data;
};

/**
 * Update lease template
 * PUT: /api/LeaseTemplate/{id}
 */
export const updateLeaseTemplate = async (id, template) => {
  const response = await axiosServices.put(`/api/LeaseTemplate/${id}`, template);
  return response.data;
};

/**
 * Delete lease template
 * DELETE: /api/LeaseTemplate/{id}
 */
export const deleteLeaseTemplate = async (id) => {
  const response = await axiosServices.delete(`/api/LeaseTemplate/${id}`);
  return response.data;
};

/**
 * Set default template for landlord
 * POST: /api/LeaseTemplate/{id}/set-default
 */
export const setDefaultLeaseTemplate = async (id) => {
  const response = await axiosServices.post(`/api/LeaseTemplate/${id}/set-default`);
  return response.data;
};

/**
 * Ensure default template exists for organization (create if missing)
 * POST: /api/LeaseTemplate/ensure-default
 */
export const ensureDefaultLeaseTemplate = async () => {
  const response = await axiosServices.post('/api/LeaseTemplate/ensure-default');
  return response.data;
};
