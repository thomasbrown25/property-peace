import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

class DashboardAPI {
  private client = apiClient;

  async getSummary(): Promise<any> {
    const response = await this.client.get<ApiResponse<any>>('/api/Dashboard/summary');
    return response.data;
  }
}

export default new DashboardAPI();
