export const createPasswordResetApi = (http) => ({
  async requestReset(email) {
    const response = await http.post('/api/user/forgot-password', { email });
    return response.data;
  },

  async completeReset(token, newPassword) {
    const response = await http.post('/api/user/reset-password', { token, newPassword });
    return response.data;
  }
});
