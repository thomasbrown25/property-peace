import axiosServices from 'utils/axios';

const listingAIApi = {
  generateMarketingDescription: async (listingData) => {
    const response = await axiosServices.post('/api/listing/ai/generate-description', listingData, { skipAuthRedirect: true });
    return response.data;
  },
};

export default listingAIApi;
