import axiosServices from 'utils/axios';

const landlordInviteAPI = {
  createInvite: async (data) => {
    const response = await axiosServices.post('/api/landlordinvite', data);
    return response.data;
  },

  validateInviteToken: async (token) => {
    const response = await axiosServices.get(`/api/landlordinvite/validate/${token}`);
    return response.data;
  },

  getInvitesByAdmin: async () => {
    const response = await axiosServices.get('/api/landlordinvite/admin');
    return response.data;
  },

  markInviteAsUsed: async (token) => {
    const response = await axiosServices.post(`/api/landlordinvite/mark-used/${token}`);
    return response.data;
  }
};

export default landlordInviteAPI;
