import ApiClient from './client.js';

export class TimeEntryAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async startTimer(data) {
    return this.client.post('/api/time-entry/start', data);
  }

  async stopTimer(timeEntryId, data) {
    return this.client.post(`/api/time-entry/${timeEntryId}/stop`, data);
  }

  async createTimeEntry(data) {
    return this.client.post('/api/time-entry', data);
  }

  async updateTimeEntry(timeEntryId, data) {
    return this.client.put(`/api/time-entry/${timeEntryId}`, data);
  }

  async deleteTimeEntry(timeEntryId) {
    return this.client.delete(`/api/time-entry/${timeEntryId}`);
  }

  async getTimeEntryById(timeEntryId) {
    return this.client.get(`/api/time-entry/${timeEntryId}`);
  }

  async getTimeEntries(filters = {}) {
    const { propertyId, staffMemberId, startDate, endDate, status, maintenanceRequestId } = filters;
    const params = new URLSearchParams();
    
    if (propertyId) params.append('propertyId', propertyId);
    if (staffMemberId) params.append('staffMemberId', staffMemberId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (status) params.append('status', status);
    if (maintenanceRequestId) params.append('maintenanceRequestId', maintenanceRequestId);

    return this.client.get(`/api/time-entry?${params.toString()}`);
  }

  async getTimeEntriesByProperty(propertyId, filters = {}) {
    const { startDate, endDate } = filters;
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.client.get(`/api/time-entry/property/${propertyId}?${params.toString()}`);
  }

  async getTimeEntriesByStaffMember(staffMemberId, filters = {}) {
    const { startDate, endDate } = filters;
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.client.get(`/api/time-entry/staff/${staffMemberId}?${params.toString()}`);
  }

  async getTimeEntriesByMaintenanceRequest(maintenanceRequestId) {
    return this.client.get(`/api/time-entry/maintenance/${maintenanceRequestId}`);
  }

  async getPendingApprovals() {
    return this.client.get('/api/time-entry/pending-approvals');
  }

  async submitForApproval(timeEntryId, data) {
    return this.client.post(`/api/time-entry/${timeEntryId}/submit`, data);
  }

  async approveTimeEntry(timeEntryId, data) {
    return this.client.post(`/api/time-entry/${timeEntryId}/approve`, data);
  }
}

export default TimeEntryAPI;
