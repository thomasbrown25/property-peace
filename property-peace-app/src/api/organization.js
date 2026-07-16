import axios from 'utils/axios';

// Create a new organization
export const createOrganization = async (name, description) => {
  const response = await axios.post('/api/organization', {
    name,
    description
  });
  return response.data;
};

// Get organization by ID
export const getOrganizationById = async (organizationId) => {
  const response = await axios.get(`/api/organization/${organizationId}`);
  return response.data;
};

// Get current user's active organization
export const getCurrentOrganization = async () => {
  const response = await axios.get('/api/organization/current');
  return response.data;
};

// Get all organizations for current user
export const getUserOrganizations = async () => {
  const response = await axios.get('/api/organization/user/list');
  return response.data;
};

// Update organization
export const updateOrganization = async (organizationId, name, description) => {
  const response = await axios.put('/api/organization', {
    id: organizationId,
    name,
    description
  });
  return response.data;
};

// Delete organization
export const deleteOrganization = async (organizationId) => {
  const response = await axios.delete(`/api/organization/${organizationId}`);
  return response.data;
};

// Switch active organization
export const switchOrganization = async (organizationId) => {
  const response = await axios.post('/api/organization/switch', {
    organizationId
  });
  return response.data;
};

// Update agent enable/disable settings for the current user's organization
export const updateAgentSettings = async ({ isMaintenanceAgentEnabled, isCollectionsAgentEnabled }) => {
  const response = await axios.patch('/api/organization/agent-settings', {
    isMaintenanceAgentEnabled,
    isCollectionsAgentEnabled
  });
  return response.data;
};

export const organizationAPI = {
  createOrganization,
  getOrganizationById,
  getCurrentOrganization,
  getUserOrganizations,
  updateOrganization,
  deleteOrganization,
  switchOrganization,
  updateAgentSettings
};

export default organizationAPI;

