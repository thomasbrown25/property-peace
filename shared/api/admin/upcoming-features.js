import ApiClient from '../client.js';

export class AdminUpcomingFeaturesAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getAllUpcomingFeatures() {
    return this.client.get('/api/upcomingfeature/admin/all');
  }

  async getUpcomingFeatureById(id) {
    return this.client.get(`/api/upcomingfeature/admin/${id}`);
  }

  async createUpcomingFeature(feature) {
    return this.client.post('/api/upcomingfeature/admin', feature);
  }

  async updateUpcomingFeature(id, feature) {
    return this.client.put(`/api/upcomingfeature/admin/${id}`, feature);
  }

  async deleteUpcomingFeature(id) {
    return this.client.delete(`/api/upcomingfeature/admin/${id}`);
  }
}

export default AdminUpcomingFeaturesAPI;
