import ApiClient from './client.js';

export class TimeTrackingSettingsAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getSettings() {
    return this.client.get('/api/time-tracking-settings');
  }

  async updateSettings(data) {
    return this.client.put('/api/time-tracking-settings', data);
  }
}

export default TimeTrackingSettingsAPI;
