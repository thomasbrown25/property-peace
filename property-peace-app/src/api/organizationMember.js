import axios from 'utils/axios';

// Add a member to an organization
export const addMember = async (organizationId, userId, role) => {
  const response = await axios.post('/api/organization/members', {
    organizationId,
    userId,
    role
  });
  return response.data;
};

// Get all members of an organization
export const getMembers = async (organizationId) => {
  const response = await axios.get(`/api/organization/members/${organizationId}`);
  return response.data;
};

// Update member role/permissions
export const updateMember = async (memberId, role, permissions) => {
  const response = await axios.put('/api/organization/members', {
    id: memberId,
    role,
    ...permissions
  });
  return response.data;
};

// Remove a member from an organization
export const removeMember = async (organizationId, memberUserId) => {
  const response = await axios.delete(`/api/organization/members/${organizationId}/${memberUserId}`);
  return response.data;
};

// Check if user has permission
export const checkPermission = async (organizationId, permission) => {
  const response = await axios.get(`/api/organization/members/permission/${organizationId}?permission=${permission}`);
  return response.data;
};

export const organizationMemberAPI = {
  addMember,
  getMembers,
  updateMember,
  removeMember,
  checkPermission
};

export default organizationMemberAPI;

