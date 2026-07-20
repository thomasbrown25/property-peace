import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

class RentCollectionAPI {
  private client = apiClient;

  async getRentCollection(): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/api/rent-collection');
    return response.data;
  }

  async sendReminder(leaseId: string | number): Promise<any> {
    const response = await this.client.post<ApiResponse<any>>(`/api/rent-collection/send-reminder/${leaseId}`);
    return response.data;
  }
}

export default new RentCollectionAPI();
