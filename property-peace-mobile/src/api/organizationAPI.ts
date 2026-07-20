import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

interface Organization {
  id: string;
  name: string;
  description?: string;
}

class OrganizationAPI {
  private client = apiClient;

  async createOrganization(name: string, description?: string): Promise<Organization> {
    const response = await this.client.post<ApiResponse<Organization>>('/api/organization', {
      name,
      description,
    });
    return response.data;
  }

  async getOrganizationById(organizationId: string): Promise<Organization> {
    const response = await this.client.get<ApiResponse<Organization>>(`/api/organization/${organizationId}`);
    return response.data;
  }

  async getCurrentOrganization(): Promise<Organization> {
    const response = await this.client.get<ApiResponse<Organization>>('/api/organization/current');
    return response.data;
  }

  async getUserOrganizations(): Promise<Organization[]> {
    const response = await this.client.get<ApiResponse<Organization[]>>('/api/organization/user/list');
    return response.data;
  }

  async updateOrganization(organizationId: string, name: string, description?: string): Promise<Organization> {
    const response = await this.client.put<ApiResponse<Organization>>('/api/organization', {
      id: organizationId,
      name,
      description,
    });
    return response.data;
  }

  async deleteOrganization(organizationId: string): Promise<void> {
    await this.client.delete(`/api/organization/${organizationId}`);
  }

  async switchOrganization(organizationId: string): Promise<void> {
    await this.client.post('/api/organization/switch', { organizationId });
  }
}

export default new OrganizationAPI();
