import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

export interface MaintenanceRequest {
  id?: string | number;
  title?: string;
  description?: string;
  status?: string;
  propertyId?: string | number;
  unitId?: string | number;
  [key: string]: any;
}

class MaintenanceAPI {
  private client = apiClient;

  async getCurrent(): Promise<MaintenanceRequest[]> {
    const response = await this.client.get<ApiResponse<MaintenanceRequest[]>>('/api/maintenance-request/organization/current');
    return response.data;
  }

  async createMaintenanceRequest(request: Partial<MaintenanceRequest>): Promise<MaintenanceRequest> {
    const formData = new FormData();
    formData.append('maintenanceData', JSON.stringify(request));
    formData.append('files', '' as any);
    const response = await this.client.post<ApiResponse<MaintenanceRequest>>('/api/maintenance-request', formData);
    return response.data;
  }
}

export default new MaintenanceAPI();
