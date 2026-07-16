import axiosServices from 'utils/axios';

/**
 * Get all LeaseShield state law sources (Admin only)
 * GET: /api/admin/lease-shield/sources
 */
export const getLeaseShieldStateLawSources = async () => {
  const response = await axiosServices.get('/api/admin/lease-shield/sources');
  return response.data;
};

/**
 * Create or update a LeaseShield state law source (Admin only)
 * PUT: /api/admin/lease-shield/sources
 * @param {{ state: string, baseUrl?: string|null, description?: string|null }} payload
 */
export const upsertLeaseShieldStateLawSource = async (payload) => {
  const response = await axiosServices.put('/api/admin/lease-shield/sources', payload);
  return response.data;
};

/**
 * Delete a LeaseShield state law source by state (Admin only)
 * DELETE: /api/admin/lease-shield/sources/{state}
 */
export const deleteLeaseShieldStateLawSource = async (state) => {
  const response = await axiosServices.delete(`/api/admin/lease-shield/sources/${encodeURIComponent(state)}`);
  return response.data;
};
