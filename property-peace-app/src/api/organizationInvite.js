import axios from 'utils/axios';

// Create an invite
export const createInvite = async (organizationId, email, role) => {
  const response = await axios.post('/api/organization/invites', {
    organizationId,
    email,
    role
  });
  return response.data;
};

// Get invites for an organization
export const getInvites = async (organizationId) => {
  const response = await axios.get(`/api/organization/invites/${organizationId}`);
  return response.data;
};

// Get invite by token
export const getInviteByToken = async (token) => {
  const response = await axios.get(`/api/organization/invites/token/${token}`);
  return response.data;
};

// Accept an invite
export const acceptInvite = async (token) => {
  const response = await axios.post('/api/organization/invites/accept', {
    token
  });
  return response.data;
};

// Delete an invite
export const deleteInvite = async (inviteId) => {
  const response = await axios.delete(`/api/organization/invites/${inviteId}`);
  return response.data;
};

// Resend an invite (generates new token and extends expiration)
export const resendInvite = async (inviteId) => {
  const response = await axios.post(`/api/organization/invites/${inviteId}/resend`);
  return response.data;
};

// Get pending invites for current user's email
export const getPendingInvites = async () => {
  const response = await axios.get('/api/organization/invites/pending');
  return response.data;
};

export const organizationInviteAPI = {
  createInvite,
  getInvites,
  getInviteByToken,
  acceptInvite,
  deleteInvite,
  resendInvite,
  getPendingInvites
};

export default organizationInviteAPI;

