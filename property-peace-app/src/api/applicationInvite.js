import axiosServices from 'utils/axios';

/**
 * Create and send an application invite
 * @param {Object} inviteData - { propertyId, unitId?, email, applicantName? }
 * @returns {Promise} API response
 */
export const createApplicationInvite = async (inviteData) => {
  const response = await axiosServices.post('/api/applicationinvite', inviteData);
  return response.data;
};

/**
 * Get application invites by property ID
 * @param {number} propertyId - Property ID
 * @returns {Promise} API response
 */
export const getApplicationInvitesByProperty = async (propertyId) => {
  const response = await axiosServices.get(`/api/applicationinvite/property/${propertyId}`);
  return response.data;
};

/**
 * Get application invites by landlord ID
 * @returns {Promise} API response
 */
export const getApplicationInvitesByLandlord = async () => {
  const response = await axiosServices.get('/api/applicationinvite/landlord');
  return response.data;
};

/**
 * Delete an application invite
 * @param {number} inviteId - Invite ID
 * @returns {Promise} API response
 */
export const deleteApplicationInvite = async (inviteId) => {
  const response = await axiosServices.delete(`/api/applicationinvite/${inviteId}`);
  return response.data;
};

/**
 * Resend an application invite
 * @param {number} inviteId - Invite ID
 * @returns {Promise} API response
 */
export const resendApplicationInvite = async (inviteId) => {
  const response = await axiosServices.post(`/api/applicationinvite/${inviteId}/resend`);
  return response.data;
};

/**
 * Resend an application invite by application ID
 * @param {number} applicationId - Application ID
 * @returns {Promise} API response
 */
export const resendApplicationInviteByApplicationId = async (applicationId) => {
  const response = await axiosServices.post(`/api/applicationinvite/application/${applicationId}/resend`);
  return response.data;
};

/**
 * Validate an application invite token (public endpoint)
 * @param {string} token - Invite token
 * @returns {Promise} API response
 */
export const validateApplicationInviteToken = async (token) => {
  const response = await axiosServices.get(`/api/applicationinvite/validate/${token}`);
  return response.data;
};

/**
 * Submit a rental application (public endpoint for invite-based submissions)
 * @param {string} token - Application invite token
 * @param {Object} applicationData - Application data
 * @returns {Promise} API response
 */
export const submitApplicationWithToken = async (token, applicationData) => {
  const response = await axiosServices.post(`/api/applicationinvite/submit/${token}`, applicationData);
  return response.data;
};

