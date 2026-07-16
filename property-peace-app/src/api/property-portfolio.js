import axiosServices from 'utils/axios';

const endpoints = {
  key: 'api/PropertyPortfolio',
  analytics: (landlordId, propertyId, timeRange) => {
    const params = new URLSearchParams();
    if (propertyId) params.append('propertyId', propertyId);
    params.append('timeRange', timeRange);
    return `/api/PropertyPortfolio/${landlordId}/analytics?${params.toString()}`;
  },
  occupancy: (landlordId, propertyId) => {
    const params = new URLSearchParams();
    if (propertyId) params.append('propertyId', propertyId);
    const queryString = params.toString();
    return `/api/PropertyPortfolio/${landlordId}/occupancy${queryString ? `?${queryString}` : ''}`;
  },
  calendar: (landlordId, propertyId, startDate, endDate) => {
    const params = new URLSearchParams();
    if (propertyId) params.append('propertyId', propertyId);
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    const queryString = params.toString();
    return `/api/PropertyPortfolio/${landlordId}/calendar${queryString ? `?${queryString}` : ''}`;
  }
};

/**
 * Get property portfolio analytics
 * @param {number} landlordId - Landlord ID
 * @param {number|null} propertyId - Optional property ID filter
 * @param {string} timeRange - Time range: '3months', '6months', '12months', 'all'
 * @returns {Promise} Analytics data
 */
export const getPropertyPortfolioAnalytics = async (landlordId, propertyId = null, timeRange = '12months') => {
  try {
    const response = await axiosServices.get(endpoints.analytics(landlordId, propertyId, timeRange));
    return response.data?.data || response.data;
  } catch (error) {
    console.error('Error fetching property portfolio analytics:', error);
    throw error;
  }
};

/**
 * Get property occupancy data
 * @param {number} landlordId - Landlord ID
 * @param {number|null} propertyId - Optional property ID filter
 * @returns {Promise} Occupancy data
 */
export const getPropertyOccupancyData = async (landlordId, propertyId = null) => {
  try {
    const response = await axiosServices.get(endpoints.occupancy(landlordId, propertyId));
    return response.data?.data || response.data;
  } catch (error) {
    console.error('Error fetching property occupancy data:', error);
    throw error;
  }
};

/**
 * Get unit availability calendar data
 * @param {number} landlordId - Landlord ID
 * @param {number|null} propertyId - Optional property ID filter
 * @param {Date|null} startDate - Optional start date (defaults to today)
 * @param {Date|null} endDate - Optional end date (defaults to 6 months from today)
 * @returns {Promise} Calendar data
 */
export const getUnitAvailabilityCalendar = async (landlordId, propertyId = null, startDate = null, endDate = null) => {
  try {
    const response = await axiosServices.get(endpoints.calendar(landlordId, propertyId, startDate, endDate));
    return response.data?.data || response.data;
  } catch (error) {
    console.error('Error fetching unit availability calendar:', error);
    throw error;
  }
};

export { endpoints };

