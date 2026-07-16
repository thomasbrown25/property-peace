import axios from 'utils/axios';

// Get all upcoming features (admin - includes inactive)
export const getAllUpcomingFeatures = async () => {
  const response = await axios.get('/api/upcomingfeature/admin/all');
  return response.data;
};

// Get upcoming feature by ID (admin)
export const getUpcomingFeatureById = async (id) => {
  const response = await axios.get(`/api/upcomingfeature/admin/${id}`);
  return response.data;
};

// Create upcoming feature (admin)
export const createUpcomingFeature = async (feature) => {
  const response = await axios.post('/api/upcomingfeature/admin', feature);
  return response.data;
};

// Update upcoming feature (admin)
export const updateUpcomingFeature = async (id, feature) => {
  const response = await axios.put(`/api/upcomingfeature/admin/${id}`, feature);
  return response.data;
};

// Delete upcoming feature (admin)
export const deleteUpcomingFeature = async (id) => {
  const response = await axios.delete(`/api/upcomingfeature/admin/${id}`);
  return response.data;
};

export const adminUpcomingFeaturesAPI = {
  getAll: getAllUpcomingFeatures,
  getById: getUpcomingFeatureById,
  create: createUpcomingFeature,
  update: updateUpcomingFeature,
  delete: deleteUpcomingFeature
};

export default adminUpcomingFeaturesAPI;

