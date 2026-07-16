import ApiClient from './client.js';

export class ChecklistAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async addChecklist(checklist) {
    return this.client.post('/api/Checklist', checklist);
  }

  async getChecklist(id) {
    return this.client.get(`/api/Checklist/${id}`);
  }

  async getChecklistsByLandlord(landlordId) {
    return this.client.get(`/api/Checklist/landlord/${landlordId}`);
  }

  async getChecklistsByProperty(propertyId) {
    return this.client.get(`/api/Checklist/property/${propertyId}`);
  }

  async getChecklistsByUnit(unitId) {
    return this.client.get(`/api/Checklist/unit/${unitId}`);
  }

  async getChecklistsByLease(leaseId) {
    return this.client.get(`/api/Checklist/lease/${leaseId}`);
  }

  async getChecklistsByType(checklistType) {
    return this.client.get(`/api/Checklist/type/${checklistType}`);
  }

  async updateChecklist(id, checklist) {
    return this.client.put(`/api/Checklist/${id}`, checklist);
  }

  async deleteChecklist(id) {
    return this.client.delete(`/api/Checklist/${id}`);
  }

  async uploadChecklistImages(checklistId, files, isBeforeMoveIn = true) {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    formData.append('isBeforeMoveIn', isBeforeMoveIn);

    return this.client.post(`/api/Checklist/${checklistId}/upload-images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  async deleteChecklistImage(checklistId, blobName, isBeforeMoveIn = true) {
    return this.client.delete(
      `/api/Checklist/${checklistId}/images/${encodeURIComponent(blobName)}?isBeforeMoveIn=${isBeforeMoveIn}`
    );
  }

  async uploadItemImage(checklistId, itemId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.client.post(
      `/api/Checklist/${checklistId}/items/${itemId}/upload-image`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  }

  async deleteItemImage(checklistId, itemId, blobName) {
    return this.client.delete(
      `/api/Checklist/${checklistId}/items/${itemId}/images/${encodeURIComponent(blobName)}`
    );
  }
}

export default ChecklistAPI;
