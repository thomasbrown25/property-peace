import axiosServices from 'utils/axios';

/**
 * Get all tenants for the current organization (for search / add to lease).
 * GET: /api/Tenant/organization
 */
export const getTenantsByOrganization = async () => {
  const response = await axiosServices.get('/api/Tenant/organization');
  return response.data;
};
