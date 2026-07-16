import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

export interface Tenant {
  id?: string | number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  [key: string]: any;
}

class TenantAPI {
  private client = apiClient;

  async getTenants(): Promise<Tenant[]> {
    const response = await this.client.get<ApiResponse<Tenant[]>>('/api/Tenant/organization');
    return response.data;
  }

  async createTenant(tenant: Partial<Tenant>): Promise<Tenant> {
    const response = await this.client.post<ApiResponse<Tenant>>('/api/Tenant', tenant);
    return response.data;
  }
}

export default new TenantAPI();
