import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

class RentCollectionAPI {
  private client = apiClient;

  async getRentCollection(propertyId?: string | number): Promise<any> {
    const path = propertyId == null ? '/api/rent-collection' : `/api/rent-collection?propertyId=${encodeURIComponent(String(propertyId))}`;
    const response = await this.client.get<ApiResponse<any>>(path);
    return response.data;
  }

  async sendReminder(leaseId: string | number): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/api/rent-collection/send-reminder/${leaseId}`);
    return response.data;
  }
}

export default new RentCollectionAPI();
