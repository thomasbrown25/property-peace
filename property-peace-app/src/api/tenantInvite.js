import axiosServices from 'utils/axios';

/**
 * Create and send a tenant invite
 * @param {Object} inviteData - { tenantId, email }
 * @returns {Promise} API response
 */
export const createTenantInvite = async (inviteData) => {
  const response = await axiosServices.post('/api/tenantinvite', inviteData);
  return response.data;
};

/**
 * Validate an invite token (public endpoint)
 * @param {string} token - Invite token
 * @returns {Promise} API response
 */
export const validateInviteToken = async (token) => {
  const response = await axiosServices.get(`/api/tenantinvite/validate/${token}`);
  return response.data;
};

/**
 * Get invites by tenant ID
 * @param {number} tenantId - Tenant ID
 * @returns {Promise} API response
 */
export const getInvitesByTenantId = async (tenantId) => {
  const response = await axiosServices.get(`/api/tenantinvite/tenant/${tenantId}`);
  return response.data;
};

/**
 * Get invites by landlord (current user)
 * @returns {Promise} API response
 */
export const getInvitesByLandlord = async () => {
  const response = await axiosServices.get('/api/tenantinvite/landlord');
  return response.data;
};

/**
 * Delete an invite
 * @param {number} inviteId - Invite ID
 * @returns {Promise} API response
 */
export const deleteInvite = async (inviteId) => {
  const response = await axiosServices.delete(`/api/tenantinvite/${inviteId}`);
  return response.data;
};

/**
 * Resend an invite
 * @param {number} inviteId - Invite ID
 * @returns {Promise} API response
 */
export const resendInvite = async (inviteId) => {
  const response = await axiosServices.post(`/api/tenantinvite/${inviteId}/resend`);
  return response.data;
};

/**
 * Accept tenant invite for existing user
 * @param {Object} dto - { inviteToken, email }
 * @returns {Promise} API response
 */
export const acceptTenantInvite = async (dto) => {
  const response = await axiosServices.post('/api/tenantinvite/accept', dto);
  return response.data;
};
