import ApiClient from '../client.js';

export class LandlordUpcomingFeaturesAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getActiveUpcomingFeatures() {
    return this.client.get('/api/upcomingfeature/active');
  }
}

export default LandlordUpcomingFeaturesAPI;
