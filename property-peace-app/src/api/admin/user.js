import axios from 'utils/axios';

// Get all users (admin)
export const getAllUsers = async (includeDeleted = false) => {
  const response = await axios.get(`/api/admin/user/all?includeDeleted=${includeDeleted}`);
  return response.data;
};

// Delete a user by ID (admin)
export const deleteUser = async (userId) => {
  const response = await axios.delete(`/api/admin/user/${userId}`);
  return response.data;
};

// Update a user by ID (admin)
export const updateUser = async (userId, userData) => {
  const response = await axios.put(`/api/admin/user/${userId}`, userData);
  return response.data;
};

// Suspend a user account (admin)
export const suspendUser = async (userId) => {
  const response = await axios.post(`/api/admin/user/${userId}/suspend`);
  return response.data;
};

// Unsuspend a user account (admin)
export const unsuspendUser = async (userId) => {
  const response = await axios.post(`/api/admin/user/${userId}/unsuspend`);
  return response.data;
};

// Set a user's password (admin) - no current password required. Works for Google users too.
export const setPassword = async (userId, newPassword) => {
  const response = await axios.post(`/api/admin/user/${userId}/set-password`, { newPassword });
  return response.data;
};

export const adminUserAPI = {
  getAllUsers,
  deleteUser,
  updateUser,
  suspendUser,
  unsuspendUser,
  setPassword
};

export default adminUserAPI;

