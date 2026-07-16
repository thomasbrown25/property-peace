import ApiClient from './client.js';

export class FileCategoryAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getFileCategories() {
    return this.client.get('/api/filecategory');
  }

  async getFileCategoryById(id) {
    return this.client.get(`/api/filecategory/${id}`);
  }

  async addFileCategory(data) {
    return this.client.post('/api/filecategory', data);
  }

  async updateFileCategory(id, data) {
    return this.client.put(`/api/filecategory/${id}`, data);
  }

  async deleteFileCategory(id) {
    return this.client.delete(`/api/filecategory/${id}`);
  }
}

export default FileCategoryAPI;
