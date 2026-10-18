import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

class RentCollectionAPI {
  private client = apiClient;

  async getRentCollection(propertyId?: string | number, month?: string): Promise<any> {
    const params = new URLSearchParams();
    if (propertyId != null) params.set('propertyId', String(propertyId));
    if (month != null) params.set('month', month);
    const path = `/api/rent-collection${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.client.get<ApiResponse<any>>(path);
    return response.data;
  }

  async sendReminder(leaseId: string | number): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/api/rent-collection/send-reminder/${leaseId}`);
    return response.data;
  }
}

export default new RentCollectionAPI();
