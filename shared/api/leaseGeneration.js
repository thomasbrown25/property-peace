import ApiClient from './client.js';

export class LeaseGenerationAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getPlaceholderCatalog() {
    return this.client.get('/api/LeaseGeneration/placeholders');
  }

  async createLeaseInstance(instanceData) {
    return this.client.post('/api/LeaseGeneration/instance', instanceData);
  }

  async getLeaseInstance(id) {
    return this.client.get(`/api/LeaseGeneration/instance/${id}`);
  }

  async resolvePlaceholders(id) {
    return this.client.post(`/api/LeaseGeneration/instance/${id}/resolve`);
  }

  async validatePlaceholders(id) {
    return this.client.get(`/api/LeaseGeneration/instance/${id}/validate`);
  }

  async finalizeLeaseInstance(id) {
    return this.client.post(`/api/LeaseGeneration/instance/${id}/finalize`);
  }

  async generateLeasePdf(id) {
    return this.client.post(`/api/LeaseGeneration/instance/${id}/generate-pdf`, {}, {
      responseType: 'blob'
    });
  }

  async generateLeaseDocx(id) {
    return this.client.post(`/api/LeaseGeneration/instance/${id}/generate-docx`, {}, {
      responseType: 'blob'
    });
  }

  async generateAndSavePdf(id) {
    return this.client.post(`/api/LeaseGeneration/instance/${id}/generate-and-save-pdf`);
  }

  async generateAndSaveDocx(id) {
    return this.client.post(`/api/LeaseGeneration/instance/${id}/generate-and-save-docx`);
  }

  async getLeaseInstanceDocuments(id) {
    return this.client.get(`/api/LeaseGeneration/instance/${id}/documents`);
  }

  async formatPolicies(policies, tone = 'Neutral') {
    return this.client.post('/api/LeaseGeneration/policies/format', {
      rawPolicies: policies,
      tone
    });
  }

  async suggestPolicies(tone = 'Neutral') {
    return this.client.post('/api/LeaseGeneration/policies/suggest', {
      tone
    });
  }

  async normalizePolicies(policies) {
    return this.client.post('/api/LeaseGeneration/policies/normalize', policies);
  }

  // Platform-specific method - web only
  downloadDocument(blob, fileName, mimeType) {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = window.URL.createObjectURL(new Blob([blob], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  }
}

export default LeaseGenerationAPI;
