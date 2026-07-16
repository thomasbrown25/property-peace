import ApiClient from './client.js';

export class FileAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getFiles(filters = {}) {
    const params = new URLSearchParams();
    if (filters.categoryId) params.append('categoryId', filters.categoryId);
    if (filters.propertyId) params.append('propertyId', filters.propertyId);
    if (filters.unitId) params.append('unitId', filters.unitId);
    if (filters.leaseId) params.append('leaseId', filters.leaseId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    return this.client.get(`/api/file?${params.toString()}`);
  }

  async getFileById(id) {
    return this.client.get(`/api/file/${id}`);
  }

  async uploadFiles(files, data = {}) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    if (data.title) formData.append('title', data.title);
    if (data.categoryId) formData.append('categoryId', data.categoryId);
    if (data.propertyId) formData.append('propertyId', data.propertyId);
    if (data.unitId) formData.append('unitId', data.unitId);
    if (data.leaseId) formData.append('leaseId', data.leaseId);

    return this.client.post('/api/file/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  async updateFile(id, data) {
    return this.client.put(`/api/file/${id}`, data);
  }

  async deleteFile(id) {
    return this.client.delete(`/api/file/${id}`);
  }
}

export default FileAPI;
