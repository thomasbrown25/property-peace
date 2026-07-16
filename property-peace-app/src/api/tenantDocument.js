import axiosServices from 'utils/axios';

/**
 * Upload tenant documents
 * POST: /api/TenantDocument/upload
 */
export const uploadTenantDocuments = async (tenantId, files, options = {}) => {
  const formData = new FormData();
  formData.append('tenantId', tenantId.toString());
  
  // Append each file
  if (Array.isArray(files)) {
    files.forEach(file => {
      formData.append('files', file);
    });
  } else {
    formData.append('files', files);
  }
  
  // Append optional fields
  if (options.description) formData.append('description', options.description);
  if (options.documentType !== undefined) formData.append('documentType', options.documentType);
  if (options.expirationDate) formData.append('expirationDate', options.expirationDate);
  if (options.isRequired !== undefined) formData.append('isRequired', options.isRequired);
  if (options.leaseId) formData.append('leaseId', options.leaseId.toString());
  
  const response = await axiosServices.post('/api/TenantDocument/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data;
};

/**
 * Get tenant document by ID
 * GET: /api/TenantDocument/{id}
 */
export const getTenantDocument = async (id) => {
  const response = await axiosServices.get(`/api/TenantDocument/${id}`);
  return response.data;
};

/**
 * Get documents by tenant ID
 * GET: /api/TenantDocument/tenant/{tenantId}
 */
export const getTenantDocumentsByTenant = async (tenantId) => {
  const response = await axiosServices.get(`/api/TenantDocument/tenant/${tenantId}`);
  return response.data;
};

/**
 * Get documents by landlord ID
 * GET: /api/TenantDocument/landlord/{landlordId}
 */
export const getTenantDocumentsByLandlord = async (landlordId) => {
  const response = await axiosServices.get(`/api/TenantDocument/landlord/${landlordId}`);
  return response.data;
};

/**
 * Get lease agreement by lease ID
 * GET: /api/TenantDocument/lease/{leaseId}/agreement
 */
export const getLeaseAgreement = async (leaseId) => {
  const response = await axiosServices.get(`/api/TenantDocument/lease/${leaseId}/agreement`);
  return response.data;
};

/**
 * Get expiring documents for a landlord
 * GET: /api/TenantDocument/landlord/{landlordId}/expiring?daysAhead={daysAhead}
 */
export const getExpiringDocuments = async (landlordId, daysAhead = 30) => {
  const response = await axiosServices.get(`/api/TenantDocument/landlord/${landlordId}/expiring`, {
    params: { daysAhead }
  });
  return response.data;
};

/**
 * Update tenant document
 * PUT: /api/TenantDocument/{id}
 */
export const updateTenantDocument = async (id, document) => {
  const response = await axiosServices.put(`/api/TenantDocument/${id}`, document);
  return response.data;
};

/**
 * Delete tenant document
 * DELETE: /api/TenantDocument/{id}
 */
export const deleteTenantDocument = async (id) => {
  const response = await axiosServices.delete(`/api/TenantDocument/${id}`);
  return response.data;
};

/**
 * Download tenant document (opens the SAS URL)
 */
export const downloadTenantDocument = (blobUrl, fileName) => {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName || 'document';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

