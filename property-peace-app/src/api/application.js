import axiosServices from 'utils/axios';

/**
 * Add a new rental application (landlord-side)
 * POST: /api/Application
 */
export const addApplication = async (application) => {
  const response = await axiosServices.post('/api/Application', application);
  return response.data;
};

/**
 * Submit a public rental application (no auth required)
 * POST: /api/Application/public
 * @param {{ listingNumber, firstName, lastName, email, phoneNumber, desiredMoveInDate, numberOfOccupants, hasPets, petDetails, additionalNotes }} data
 */
export const submitPublicApplication = async (data) => {
  const response = await axiosServices.post('/api/Application/public', data);
  return response.data;
};

/**
 * Get application by ID
 * GET: /api/Application/{id}
 */
export const getApplication = async (id) => {
  const response = await axiosServices.get(`/api/Application/${id}`);
  return response.data;
};

/**
 * Get applications by landlord ID
 * GET: /api/Application/landlord/{landlordId}
 */
export const getApplicationsByLandlord = async (landlordId) => {
  const response = await axiosServices.get(`/api/Application/landlord/${landlordId}`);
  return response.data;
};

/**
 * Get applications by property ID
 * GET: /api/Application/property/{propertyId}
 */
export const getApplicationsByProperty = async (propertyId) => {
  const response = await axiosServices.get(`/api/Application/property/${propertyId}`);
  return response.data;
};

/**
 * Get applications by status
 * GET: /api/Application/status/{status}
 */
export const getApplicationsByStatus = async (status) => {
  const response = await axiosServices.get(`/api/Application/status/${status}`);
  return response.data;
};

/**
 * Update application
 * PUT: /api/Application/{id}
 */
export const updateApplication = async (id, application) => {
  const response = await axiosServices.put(`/api/Application/${id}`, application);
  return response.data;
};

/**
 * Update application status
 * PUT: /api/Application/{id}/status
 */
export const updateApplicationStatus = async (id, status, rejectionReason = null, reviewNotes = null) => {
  const response = await axiosServices.put(`/api/Application/${id}/status`, {
    status,
    rejectionReason,
    reviewNotes
  });
  return response.data;
};

/**
 * Delete application
 * DELETE: /api/Application/{id}
 */
export const deleteApplication = async (id) => {
  const response = await axiosServices.delete(`/api/Application/${id}`);
  return response.data;
};

/**
 * Download application PDF
 * GET: /api/Application/{id}/pdf
 */
export const downloadApplicationPdf = async (id) => {
  const response = await axiosServices.get(`/api/Application/${id}/pdf`, {
    responseType: 'blob'
  });
  return response.data;
};

/**
 * Generate application PDF
 * POST: /api/Application/{id}/generate-pdf
 */
export const generateApplicationPdf = async (id) => {
  const response = await axiosServices.post(`/api/Application/${id}/generate-pdf`);
  return response.data;
};

/**
 * Get applications by tenant email (for tenant portal)
 * GET: /api/Application/tenant/my-applications
 */
export const getTenantApplications = async () => {
  const response = await axiosServices.get('/api/Application/tenant/my-applications');
  return response.data;
};

/**
 * Request background check for an application
 * POST: /api/Application/{id}/background-check
 */
export const requestBackgroundCheck = async (applicationId, screeningPackage = 'full') => {
  const response = await axiosServices.post(`/api/Application/${applicationId}/background-check`, {
    applicationId,
    screeningPackage
  });
  return response.data;
};

/**
 * Get background check status for an application
 * GET: /api/Application/{id}/background-check
 */
export const getBackgroundCheckStatus = async (applicationId) => {
  const response = await axiosServices.get(`/api/Application/${applicationId}/background-check`);
  return response.data;
};

