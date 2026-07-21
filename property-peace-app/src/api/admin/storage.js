import axios from 'utils/axios';

export const getStorageSummary = async () => {
  const response = await axios.get('/api/admin/storage/summary');
  return response.data;
};

export const getStorageOrganizations = async () => {
  const response = await axios.get('/api/admin/storage/organizations');
  return response.data;
};

export const getStorageUsers = async () => {
  const response = await axios.get('/api/admin/storage/users');
  return response.data;
};

export const getStorageUser = async (userId) => {
  const response = await axios.get(`/api/admin/storage/users/${userId}`);
  return response.data;
};

export const getStorageOrganization = async (organizationId) => {
  const response = await axios.get(`/api/admin/storage/organizations/${organizationId}`);
  return response.data;
};

export const adminStorageAPI = {
  getStorageSummary,
  getStorageOrganizations,
  getStorageUsers,
  getStorageUser,
  getStorageOrganization
};

export default adminStorageAPI;
