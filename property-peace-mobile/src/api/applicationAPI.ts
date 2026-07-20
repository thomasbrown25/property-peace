import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

interface Application {
  id: string;
  [key: string]: any;
}

class ApplicationAPI {
  private client = apiClient;

  async addApplication(application: Partial<Application>): Promise<Application> {
    const response = await this.client.post<ApiResponse<Application>>('/api/Application', application);
    return response.data;
  }

  async getApplication(id: string): Promise<Application> {
    const response = await this.client.get<ApiResponse<Application>>(`/api/Application/${id}`);
    return response.data;
  }

  async getApplicationsByLandlord(landlordId: string): Promise<Application[]> {
    const response = await this.client.get<ApiResponse<Application[]>>(`/api/Application/landlord/${landlordId}`);
    return response.data;
  }

  async getApplicationsByProperty(propertyId: string): Promise<Application[]> {
    const response = await this.client.get<ApiResponse<Application[]>>(`/api/Application/property/${propertyId}`);
    return response.data;
  }

  async getApplicationsByStatus(status: string): Promise<Application[]> {
    const response = await this.client.get<ApiResponse<Application[]>>(`/api/Application/status/${status}`);
    return response.data;
  }

  async updateApplication(id: string, application: Partial<Application>): Promise<Application> {
    const response = await this.client.put<ApiResponse<Application>>(`/api/Application/${id}`, application);
    return response.data;
  }

  async updateApplicationStatus(
    id: string,
    status: string,
    rejectionReason?: string,
    reviewNotes?: string
  ): Promise<Application> {
    const response = await this.client.put<ApiResponse<Application>>(`/api/Application/${id}/status`, {
      status,
      rejectionReason,
      reviewNotes,
    });
    return response.data;
  }

  async deleteApplication(id: string): Promise<void> {
    await this.client.delete(`/api/Application/${id}`);
  }

  async getTenantApplications(): Promise<Application[]> {
    const response = await this.client.get<ApiResponse<Application[]>>('/api/Application/tenant/my-applications');
    return response.data;
  }

  async requestBackgroundCheck(applicationId: string, screeningPackage: string = 'full'): Promise<any> {
    const response = await this.client.post<ApiResponse>(`/api/Application/${applicationId}/background-check`, {
      applicationId,
      screeningPackage,
    });
    return response.data;
  }

  async getBackgroundCheckStatus(applicationId: string): Promise<any> {
    const response = await this.client.get<ApiResponse>(`/api/Application/${applicationId}/background-check`);
    return response.data;
  }
}

export default new ApplicationAPI();
