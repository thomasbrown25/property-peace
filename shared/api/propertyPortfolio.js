import ApiClient from './client.js';

export class PropertyPortfolioAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async getPropertyPortfolioAnalytics(landlordId, propertyId = null, timeRange = '12months') {
    try {
      const response = await this.client.get(
        this._buildAnalyticsUrl(landlordId, propertyId, timeRange)
      );
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching property portfolio analytics:', error);
      throw error;
    }
  }

  async getPropertyOccupancyData(landlordId, propertyId = null) {
    try {
      const response = await this.client.get(
        this._buildOccupancyUrl(landlordId, propertyId)
      );
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching property occupancy data:', error);
      throw error;
    }
  }

  async getUnitAvailabilityCalendar(landlordId, propertyId = null, startDate = null, endDate = null) {
    try {
      const response = await this.client.get(
        this._buildCalendarUrl(landlordId, propertyId, startDate, endDate)
      );
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching unit availability calendar:', error);
      throw error;
    }
  }

  _buildAnalyticsUrl(landlordId, propertyId, timeRange) {
    const params = new URLSearchParams();
    if (propertyId) params.append('propertyId', propertyId);
    params.append('timeRange', timeRange);
    return `/api/PropertyPortfolio/${landlordId}/analytics?${params.toString()}`;
  }

  _buildOccupancyUrl(landlordId, propertyId) {
    const params = new URLSearchParams();
    if (propertyId) params.append('propertyId', propertyId);
    const queryString = params.toString();
    return `/api/PropertyPortfolio/${landlordId}/occupancy${queryString ? `?${queryString}` : ''}`;
  }

  _buildCalendarUrl(landlordId, propertyId, startDate, endDate) {
    const params = new URLSearchParams();
    if (propertyId) params.append('propertyId', propertyId);
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    const queryString = params.toString();
    return `/api/PropertyPortfolio/${landlordId}/calendar${queryString ? `?${queryString}` : ''}`;
  }
}

export default PropertyPortfolioAPI;
