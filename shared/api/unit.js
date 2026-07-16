import ApiClient from './client.js';

export class UnitAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getActiveLease(propertyId) {
    return this.client.get(`/api/lease/active/${propertyId}`);
  }

  async addUnit(payload) {
    return this.client.post('/api/unit', payload);
  }
}

export default UnitAPI;
