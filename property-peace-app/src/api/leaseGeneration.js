import axiosServices from 'utils/axios';

/**
 * Get placeholder catalog
 * GET: /api/LeaseGeneration/placeholders
 */
export const getPlaceholderCatalog = async () => {
  const response = await axiosServices.get('/api/LeaseGeneration/placeholders');
  return response.data;
};

/**
 * Create lease instance
 * POST: /api/LeaseGeneration/instance
 */
export const createLeaseInstance = async (instanceData) => {
  const response = await axiosServices.post('/api/LeaseGeneration/instance', instanceData);
  return response.data;
};

/**
 * Get lease instance by ID
 * GET: /api/LeaseGeneration/instance/{id}
 */
export const getLeaseInstance = async (id) => {
  const response = await axiosServices.get(`/api/LeaseGeneration/instance/${id}`);
  return response.data;
};

/**
 * Resolve placeholders for lease instance
 * POST: /api/LeaseGeneration/instance/{id}/resolve
 */
export const resolvePlaceholders = async (id) => {
  const response = await axiosServices.post(`/api/LeaseGeneration/instance/${id}/resolve`);
  return response.data;
};

/**
 * Validate placeholders for lease instance
 * GET: /api/LeaseGeneration/instance/{id}/validate
 */
export const validatePlaceholders = async (id) => {
  const response = await axiosServices.get(`/api/LeaseGeneration/instance/${id}/validate`);
  return response.data;
};

/**
 * Finalize lease instance (makes it immutable)
 * POST: /api/LeaseGeneration/instance/{id}/finalize
 */
export const finalizeLeaseInstance = async (id) => {
  const response = await axiosServices.post(`/api/LeaseGeneration/instance/${id}/finalize`);
  return response.data;
};

/**
 * Generate PDF for lease instance
 * POST: /api/LeaseGeneration/instance/{id}/generate-pdf
 */
export const generateLeasePdf = async (id) => {
  const response = await axiosServices.post(`/api/LeaseGeneration/instance/${id}/generate-pdf`, {}, {
    responseType: 'blob'
  });
  return response.data;
};

/**
 * Generate preview PDF from lease (no instance required)
 * POST: /api/LeaseGeneration/lease/{leaseId}/preview-pdf
 */
export const getLeasePreviewPdf = async (leaseId) => {
  const response = await axiosServices.post(`/api/LeaseGeneration/lease/${leaseId}/preview-pdf`, {}, {
    responseType: 'blob'
  });
  return response.data;
};

/**
 * Generate DOCX for lease instance
 * POST: /api/LeaseGeneration/instance/{id}/generate-docx
 */
export const generateLeaseDocx = async (id) => {
  const response = await axiosServices.post(`/api/LeaseGeneration/instance/${id}/generate-docx`, {}, {
    responseType: 'blob'
  });
  return response.data;
};

/**
 * Generate and save PDF to blob storage
 * POST: /api/LeaseGeneration/instance/{id}/generate-and-save-pdf
 */
export const generateAndSavePdf = async (id) => {
  const response = await axiosServices.post(`/api/LeaseGeneration/instance/${id}/generate-and-save-pdf`);
  return response.data;
};

/**
 * Generate and save DOCX to blob storage
 * POST: /api/LeaseGeneration/instance/{id}/generate-and-save-docx
 */
export const generateAndSaveDocx = async (id) => {
  const response = await axiosServices.post(`/api/LeaseGeneration/instance/${id}/generate-and-save-docx`);
  return response.data;
};

/**
 * Get documents for lease instance
 * GET: /api/LeaseGeneration/instance/{id}/documents
 */
export const getLeaseInstanceDocuments = async (id) => {
  const response = await axiosServices.get(`/api/LeaseGeneration/instance/${id}/documents`);
  return response.data;
};

/**
 * Finish lease agreement: create instance from lease, finalize, generate and save PDF, create tenant documents.
 * POST: /api/LeaseGeneration/lease/{leaseId}/finish
 */
export const finishLeaseAgreement = async (leaseId) => {
  const response = await axiosServices.post(`/api/LeaseGeneration/lease/${leaseId}/finish`);
  return response.data;
};

/**
 * AI review of a lease instance — returns flagged issues, warnings, and suggestions.
 * POST: /api/LeaseGeneration/instance/{id}/review
 */
export const reviewLeaseInstance = async (instanceId) => {
  const response = await axiosServices.post(`/api/LeaseGeneration/instance/${instanceId}/review`);
  return response.data;
};

/**
 * Format policies using AI
 * POST: /api/LeaseGeneration/policies/format
 */
export const formatPolicies = async (policies, tone = 'Neutral') => {
  const response = await axiosServices.post('/api/LeaseGeneration/policies/format', {
    rawPolicies: policies,
    tone
  });
  return response.data;
};

/**
 * Suggest default policies
 * POST: /api/LeaseGeneration/policies/suggest
 */
export const suggestPolicies = async (tone = 'Neutral') => {
  const response = await axiosServices.post('/api/LeaseGeneration/policies/suggest', {
    tone
  });
  return response.data;
};

/**
 * Normalize policies (dedupe, group)
 * POST: /api/LeaseGeneration/policies/normalize
 */
export const normalizePolicies = async (policies) => {
  const response = await axiosServices.post('/api/LeaseGeneration/policies/normalize', policies);
  return response.data;
};

/**
 * Download document helper
 */
export const downloadDocument = (blob, fileName, mimeType) => {
  const url = window.URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
