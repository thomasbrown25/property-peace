import axiosServices from 'utils/axios';

/**
 * Add or update lease
 * POST: /api/Lease
 */
export const addOrUpdateLease = async (leaseData) => {
  const response = await axiosServices.post('/api/Lease', leaseData);
  return response.data;
};

/**
 * Send lease for e-signature
 * POST: /api/Lease/{leaseId}/send-for-signature
 */
export const sendLeaseForSignature = async (leaseId, signatureRequest) => {
  const response = await axiosServices.post(`/api/Lease/${leaseId}/send-for-signature`, signatureRequest);
  return response.data;
};

/**
 * Get lease signature status
 * GET: /api/Lease/{leaseId}/signature-status
 */
export const getLeaseSignatureStatus = async (leaseId) => {
  const response = await axiosServices.get(`/api/Lease/${leaseId}/signature-status`);
  return response.data;
};

/**
 * Cancel lease signature request
 * POST: /api/Lease/{leaseId}/cancel-signature
 */
export const cancelLeaseSignature = async (leaseId, reason = null) => {
  const response = await axiosServices.post(`/api/Lease/${leaseId}/cancel-signature`, reason);
  return response.data;
};

/**
 * Resend lease signature request
 * POST: /api/Lease/{leaseId}/resend-signature
 */
export const resendLeaseSignature = async (leaseId) => {
  const response = await axiosServices.post(`/api/Lease/${leaseId}/resend-signature`);
  return response.data;
};

/**
 * Mark lease as no longer a draft (IsDrafted = false). Call when user completes all "Finish Setting Up" steps on the lease page.
 * POST: /api/Lease/{leaseId}/complete-draft
 */
export const completeLeaseDraft = async (leaseId) => {
  const response = await axiosServices.post(`/api/Lease/${leaseId}/complete-draft`);
  return response.data;
};

/**
 * Get late fees for a lease
 * GET: /api/Lease/{leaseId}/late-fees
 */
export const getLeaseLateFees = async (leaseId) => {
  try {
    // Late fees are included in the lease data, but we can filter them
    const response = await axiosServices.get(`/api/Lease/${leaseId}`);
    const lease = response.data?.data || response.data;
    if (lease?.fees) {
      return {
        success: true,
        data: lease.fees.filter(fee => fee.isLateFee === true)
      };
    }
    return { success: true, data: [] };
  } catch (error) {
    console.error('Error fetching lease late fees:', error);
    throw error;
  }
};

/**
 * Create or update late fee for a lease
 * Late fees are managed through the lease update endpoint
 * This is a helper function to prepare the late fee data
 */
export const createOrUpdateLateFee = async (leaseId, lateFeeData) => {
  try {
    // First, get the current lease to preserve existing fees
    const leaseResponse = await axiosServices.get(`/api/Lease/${leaseId}`);
    const lease = leaseResponse.data?.data || leaseResponse.data;
    
    // Filter out existing late fees and add the new/updated one
    const otherFees = (lease?.fees || []).filter(fee => !fee.isLateFee || fee.id === lateFeeData.id);
    
    // Preserve organizationId so it is never sent as null (backend would otherwise overwrite)
    const organizationId = lease?.organizationId ?? lease?.OrganizationId ?? undefined;
    const updatedLease = {
      ...lease,
      ...(organizationId != null && { organizationId }),
      fees: [...otherFees, {
        ...lateFeeData,
        isLateFee: true,
        leaseId: leaseId,
        // Set a default DueDate if not provided (for late fees, this might not be used)
        dueDate: lateFeeData.dueDate || new Date().toISOString()
      }]
    };
    
    const response = await axiosServices.post('/api/Lease', updatedLease);
    return response.data;
  } catch (error) {
    console.error('Error creating/updating late fee:', error);
    throw error;
  }
};

/**
 * Update lease agreement step-completion flags
 * PATCH: /api/Lease/{leaseId}/agreement
 */
export const updateLeaseAgreement = async (leaseId, agreementData) => {
  const response = await axiosServices.patch(`/api/Lease/${leaseId}/agreement`, agreementData);
  return response.data;
};

/**
 * Add a tenant to a lease
 * POST: /api/Lease/{leaseId}/tenants/{tenantId}
 */
export const addTenantToLease = async (leaseId, tenantId) => {
  const response = await axiosServices.post(`/api/Lease/${leaseId}/tenants/${tenantId}`);
  return response.data;
};

/**
 * Remove a tenant from a lease
 * DELETE: /api/Lease/{leaseId}/tenants/{tenantId}
 */
export const removeTenantFromLease = async (leaseId, tenantId) => {
  const response = await axiosServices.delete(`/api/Lease/${leaseId}/tenants/${tenantId}`);
  return response.data;
};

/**
 * Delete late fee from a lease
 */
export const deleteLateFee = async (leaseId, feeId) => {
  try {
    // Get the current lease
    const leaseResponse = await axiosServices.get(`/api/Lease/${leaseId}`);
    const lease = leaseResponse.data?.data || leaseResponse.data;
    
    // Remove the fee with the given ID
    const updatedFees = (lease?.fees || []).filter(fee => fee.id !== feeId);
    
    // Preserve organizationId so it is never sent as null (backend would otherwise overwrite)
    const organizationId = lease?.organizationId ?? lease?.OrganizationId ?? undefined;
    const updatedLease = {
      ...lease,
      ...(organizationId != null && { organizationId }),
      fees: updatedFees
    };
    
    const response = await axiosServices.post('/api/Lease', updatedLease);
    return response.data;
  } catch (error) {
    console.error('Error deleting late fee:', error);
    throw error;
  }
};