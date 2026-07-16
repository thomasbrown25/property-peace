import axiosServices from 'utils/axios';

/**
 * Get a rent estimate for a specific unit.
 * Requires Premium subscription.
 *
 * @param {number} propertyId
 * @param {number} unitId
 * @param {boolean} forceRefresh bypasses the 3-month cache when true
 * @returns {Promise<{ rentEstimate, rentRangeLow, rentRangeHigh, comparables, isFromCache, cachedAt }>}
 */
export async function getRentEstimate(propertyId, unitId = null, forceRefresh = false) {
  const params = { propertyId };
  if (unitId) params.unitId = unitId;
  if (forceRefresh) params.forceRefresh = true;
  const response = await axiosServices.get('/api/rent-estimate', { params });
  return response.data?.data ?? response.data;
}
