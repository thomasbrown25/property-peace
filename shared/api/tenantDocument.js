import ApiClient from './client.js';

export class TenantDocumentAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async uploadTenantDocuments(tenantId, files, options = {}) {
    const formData = new FormData();
    formData.append('tenantId', tenantId.toString());
    
    if (Array.isArray(files)) {
      files.forEach(file => {
        formData.append('files', file);
      });
    } else {
      formData.append('files', files);
    }
    
    if (options.description) formData.append('description', options.description);
    if (options.documentType !== undefined) formData.append('documentType', options.documentType);
    if (options.expirationDate) formData.append('expirationDate', options.expirationDate);
    if (options.isRequired !== undefined) formData.append('isRequired', options.isRequired);
    if (options.leaseId) formData.append('leaseId', options.leaseId.toString());
    if (options.isPrivate !== undefined) formData.append('isPrivate', options.isPrivate);
    
    return this.client.post('/api/TenantDocument/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  /**
   * Upload document at lease level (no tenant required). Use when lease has no tenants yet.
   */
  async uploadLeaseDocuments(leaseId, files, options = {}) {
    const formData = new FormData();
    formData.append('leaseId', leaseId.toString());
    
    if (Array.isArray(files)) {
      files.forEach(file => {
        formData.append('files', file);
      });
    } else {
      formData.append('files', files);
    }
    
    if (options.description) formData.append('description', options.description);
    if (options.documentType !== undefined) formData.append('documentType', options.documentType);
    if (options.isPrivate !== undefined) formData.append('isPrivate', options.isPrivate);
    
    return this.client.post('/api/TenantDocument/upload-lease-document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  async getTenantDocument(id) {
    return this.client.get(`/api/TenantDocument/${id}`);
  }

  async getTenantDocumentsByTenant(tenantId) {
    return this.client.get(`/api/TenantDocument/tenant/${tenantId}`);
  }

  async getTenantDocumentsByLandlord(landlordId) {
    return this.client.get(`/api/TenantDocument/landlord/${landlordId}`);
  }

  async getLeaseAgreement(leaseId) {
    return this.client.get(`/api/TenantDocument/lease/${leaseId}/agreement`);
  }

  async getTenantDocumentsByLease(leaseId) {
    return this.client.get(`/api/TenantDocument/lease/${leaseId}/documents`);
  }

  async getExpiringDocuments(landlordId, daysAhead = 30) {
    return this.client.get(`/api/TenantDocument/landlord/${landlordId}/expiring`, {
      params: { daysAhead }
    });
  }

  async updateTenantDocument(id, document) {
    return this.client.put(`/api/TenantDocument/${id}`, document);
  }

  async deleteTenantDocument(id) {
    return this.client.delete(`/api/TenantDocument/${id}`);
  }

  // Platform-specific method - web only
  downloadTenantDocument(blobUrl, fileName) {
    if (typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'document';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}

export default TenantDocumentAPI;
