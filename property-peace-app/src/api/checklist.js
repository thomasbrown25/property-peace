import axiosServices from 'utils/axios';

/**
 * Add a new checklist
 * POST: /api/Checklist
 */
export const addChecklist = async (checklist) => {
  const response = await axiosServices.post('/api/Checklist', checklist);
  return response.data;
};

/**
 * Get checklist by ID
 * GET: /api/Checklist/{id}
 */
export const getChecklist = async (id) => {
  const response = await axiosServices.get(`/api/Checklist/${id}`);
  return response.data;
};

/**
 * Get checklists by landlord ID
 * GET: /api/Checklist/landlord/{landlordId}
 */
export const getChecklistsByLandlord = async (landlordId) => {
  const response = await axiosServices.get(`/api/Checklist/landlord/${landlordId}`);
  return response.data;
};

/**
 * Get checklists by property ID
 * GET: /api/Checklist/property/{propertyId}
 */
export const getChecklistsByProperty = async (propertyId) => {
  const response = await axiosServices.get(`/api/Checklist/property/${propertyId}`);
  return response.data;
};

/**
 * Get checklists by unit ID
 * GET: /api/Checklist/unit/{unitId}
 */
export const getChecklistsByUnit = async (unitId) => {
  const response = await axiosServices.get(`/api/Checklist/unit/${unitId}`);
  return response.data;
};

/**
 * Get checklists by lease ID
 * GET: /api/Checklist/lease/{leaseId}
 */
export const getChecklistsByLease = async (leaseId) => {
  const response = await axiosServices.get(`/api/Checklist/lease/${leaseId}`);
  return response.data;
};

/**
 * Get checklists by type (MoveInChecklist = 40, MoveOutChecklist = 41)
 * GET: /api/Checklist/type/{checklistType}
 */
export const getChecklistsByType = async (checklistType) => {
  const response = await axiosServices.get(`/api/Checklist/type/${checklistType}`);
  return response.data;
};

/**
 * Update checklist
 * PUT: /api/Checklist/{id}
 */
export const updateChecklist = async (id, checklist) => {
  const response = await axiosServices.put(`/api/Checklist/${id}`, checklist);
  return response.data;
};

/**
 * Delete checklist
 * DELETE: /api/Checklist/{id}
 */
export const deleteChecklist = async (id) => {
  const response = await axiosServices.delete(`/api/Checklist/${id}`);
  return response.data;
};

/**
 * Upload checklist images
 * POST: /api/Checklist/{checklistId}/upload-images
 */
export const uploadChecklistImages = async (checklistId, files, isBeforeMoveIn = true) => {
  const formData = new FormData();
  Array.from(files).forEach(file => {
    formData.append('files', file);
  });
  formData.append('isBeforeMoveIn', isBeforeMoveIn);

  const response = await axiosServices.post(
    `/api/Checklist/${checklistId}/upload-images`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  return response.data;
};

/**
 * Delete checklist image
 * DELETE: /api/Checklist/{checklistId}/images/{blobName}?isBeforeMoveIn={isBeforeMoveIn}
 */
export const deleteChecklistImage = async (checklistId, blobName, isBeforeMoveIn = true) => {
  const response = await axiosServices.delete(
    `/api/Checklist/${checklistId}/images/${encodeURIComponent(blobName)}?isBeforeMoveIn=${isBeforeMoveIn}`
  );
  return response.data;
};

/**
 * Get move-in report template for current organization
 * GET: /api/Checklist/move-in-report-template
 */
export const getMoveInReportTemplate = async () => {
  const response = await axiosServices.get('/api/Checklist/move-in-report-template');
  return response.data;
};

/**
 * Create or update move-in report template
 * POST: /api/Checklist/move-in-report-template
 */
export const addOrUpdateMoveInReportTemplate = async (payload) => {
  const response = await axiosServices.post('/api/Checklist/move-in-report-template', payload);
  return response.data;
};

/**
 * Mark the move-in report template step as completed for a specific lease (per-lease).
 * POST: /api/Checklist/move-in-report-template/complete-for-lease/{leaseId}
 */
export const completeMoveInReportTemplateForLease = async (leaseId) => {
  const response = await axiosServices.post(
    `/api/Checklist/move-in-report-template/complete-for-lease/${leaseId}`
  );
  return response.data;
};

