import axios from 'utils/axios';

// Get active upcoming features (for landlords)
export const getActiveUpcomingFeatures = async () => {
  const response = await axios.get('/api/upcomingfeature/active');
  return response.data;
};

export const landlordUpcomingFeaturesAPI = {
  getActive: getActiveUpcomingFeatures
};

export default landlordUpcomingFeaturesAPI;

