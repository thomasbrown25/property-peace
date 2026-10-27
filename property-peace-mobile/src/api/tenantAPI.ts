import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

export interface Tenant {
  id?: string | number;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phoneNumber?: string | null;
  [key: string]: any;
}

class TenantAPI {
  private client = apiClient;

  async getTenants(): Promise<Tenant[]> {
    const response = await this.client.get<ApiResponse<Tenant[]>>('/api/Tenant/organization');
    return response.data;
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    const response = await this.client.get<ApiResponse<Tenant | null>>(`/api/Tenant/${tenantId}`);
    return response.data ?? null;
  }

  async createTenant(tenant: Partial<Tenant>): Promise<Tenant> {
    const response = await this.client.post<ApiResponse<Tenant>>('/api/Tenant', tenant);
    return response.data;
  }

  async updateTenant(tenant: Omit<Partial<Tenant>, 'email' | 'phoneNumber'> & { id: string; email: string | null; phoneNumber: string | null }): Promise<Tenant> {
    const response = await this.client.post<ApiResponse<Tenant>>('/api/Tenant', tenant);
    return response.data;
  }
}

export default new TenantAPI();
