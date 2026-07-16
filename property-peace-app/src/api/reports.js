import axiosServices from 'utils/axios';

/**
 * Get occupancy report data
 * @param {Object} filters - Filter parameters
 * @param {Array<number>} filters.propertyIds - Property IDs to filter by
 * @param {Array<number>} filters.unitIds - Unit IDs to filter by
 * @param {Date} filters.startDate - Start date
 * @param {Date} filters.endDate - End date
 * @param {string} filters.timeRange - Time range preset ('3months', '6months', '12months', 'all', 'custom')
 * @returns {Promise} Report data
 */
export const getOccupancyReport = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    params.append('propertyIds', filters.propertyIds.join(','));
  }
  if (filters.unitIds && filters.unitIds.length > 0) {
    params.append('unitIds', filters.unitIds.join(','));
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange);
  }

  const response = await axiosServices.get(`/api/kpireport/occupancy?${params.toString()}`);
  return response.data;
};

/**
 * Get revenue per unit report data
 */
export const getRevenuePerUnitReport = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    params.append('propertyIds', filters.propertyIds.join(','));
  }
  if (filters.unitIds && filters.unitIds.length > 0) {
    params.append('unitIds', filters.unitIds.join(','));
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange);
  }

  const response = await axiosServices.get(`/api/kpireport/revenue-per-unit?${params.toString()}`);
  return response.data;
};

/**
 * Get units per client report data
 */
export const getUnitsPerClientReport = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    params.append('propertyIds', filters.propertyIds.join(','));
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange);
  }

  const response = await axiosServices.get(`/api/kpireport/units-per-client?${params.toString()}`);
  return response.data;
};

/**
 * Get client churn rate report data (Premium)
 */
export const getClientChurnReport = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    params.append('propertyIds', filters.propertyIds.join(','));
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange);
  }

  const response = await axiosServices.get(`/api/kpireport/client-churn?${params.toString()}`);
  return response.data;
};

/**
 * Get units per employee report data (Premium)
 */
export const getUnitsPerEmployeeReport = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    params.append('propertyIds', filters.propertyIds.join(','));
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange);
  }

  const response = await axiosServices.get(`/api/kpireport/units-per-employee?${params.toString()}`);
  return response.data;
};

/**
 * Get closing rate report data (Premium)
 */
export const getClosingRateReport = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    params.append('propertyIds', filters.propertyIds.join(','));
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange);
  }

  const response = await axiosServices.get(`/api/kpireport/closing-rate?${params.toString()}`);
  return response.data;
};

/**
 * Get median DOM (Days on Market) report data (Premium)
 */
export const getMedianDOMReport = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    params.append('propertyIds', filters.propertyIds.join(','));
  }
  if (filters.unitIds && filters.unitIds.length > 0) {
    params.append('unitIds', filters.unitIds.join(','));
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange);
  }

  const response = await axiosServices.get(`/api/kpireport/median-dom?${params.toString()}`);
  return response.data;
};

/**
 * Get median TTT (Time to Turn) report data (Premium)
 */
export const getMedianTTTReport = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    params.append('propertyIds', filters.propertyIds.join(','));
  }
  if (filters.unitIds && filters.unitIds.length > 0) {
    params.append('unitIds', filters.unitIds.join(','));
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange);
  }

  const response = await axiosServices.get(`/api/kpireport/median-ttt?${params.toString()}`);
  return response.data;
};

/**
 * Get NPS Client score report data (Premium)
 */
export const getNPSClientReport = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    params.append('propertyIds', filters.propertyIds.join(','));
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange);
  }

  const response = await axiosServices.get(`/api/kpireport/nps-client?${params.toString()}`);
  return response.data;
};

/**
 * Get NPS Tenant score report data (Premium)
 */
export const getNPSTenantReport = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.propertyIds && filters.propertyIds.length > 0) {
    params.append('propertyIds', filters.propertyIds.join(','));
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.timeRange) {
    params.append('timeRange', filters.timeRange);
  }

  const response = await axiosServices.get(`/api/kpireport/nps-tenant?${params.toString()}`);
  return response.data;
};
