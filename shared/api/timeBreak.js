import ApiClient from './client.js';

export class TimeBreakAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async addTimeBreak(timeEntryId, data) {
    return this.client.post(`/api/time-break/time-entry/${timeEntryId}`, data);
  }

  async updateTimeBreak(timeBreakId, data) {
    return this.client.put(`/api/time-break/${timeBreakId}`, data);
  }

  async deleteTimeBreak(timeBreakId) {
    return this.client.delete(`/api/time-break/${timeBreakId}`);
  }

  async getTimeBreakById(timeBreakId) {
    return this.client.get(`/api/time-break/${timeBreakId}`);
  }

  async getTimeBreaksByTimeEntryId(timeEntryId) {
    return this.client.get(`/api/time-break/time-entry/${timeEntryId}`);
  }
}

export default TimeBreakAPI;
