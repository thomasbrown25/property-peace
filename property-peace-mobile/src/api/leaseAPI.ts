import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

export interface Lease {
  id?: string | number;
  propertyId?: string | number;
  unitId?: string | number;
  startDate?: string;
  endDate?: string;
  rentAmount?: string | number;
  securityDeposit?: string | number;
  tenants?: any[];
  [key: string]: any;
}

class LeaseAPI {
  private client = apiClient;

  async getLeases(): Promise<Lease[]> {
    const response = await this.client.get<ApiResponse<Lease[]>>('/api/Lease/history');
    return response.data;
  }

  async getLease(unitId: string | number): Promise<Lease> {
    const response = await this.client.get<ApiResponse<Lease>>(`/api/Lease/${unitId}`);
    return response.data;
  }

  async getActiveLease(propertyId: string | number): Promise<Lease | null> {
    const response = await this.client.get<ApiResponse<Lease | null>>(`/api/Lease/active/${propertyId}`);
    return response.data ?? null;
  }

  async addOrUpdateLease(leaseData: Partial<Lease>): Promise<Lease> {
    const response = await this.client.post<ApiResponse<Lease>>('/api/Lease', leaseData);
    return response.data;
  }

  async addTenantToLease(leaseId: string | number, tenantId: string | number): Promise<void> {
    await this.client.post(`/api/Lease/${leaseId}/tenants/${tenantId}`);
  }

  async notifyTenant(leaseId: string | number, tenantId: string | number): Promise<void> {
    await this.client.post(`/api/Lease/${leaseId}/notify-tenant/${tenantId}`);
  }

  async sendLeaseForSignature(leaseId: string, signatureRequest: any): Promise<any> {
    const response = await this.client.post<ApiResponse>(`/api/Lease/${leaseId}/send-for-signature`, signatureRequest);
    return response.data;
  }

  async getLeaseSignatureStatus(leaseId: string): Promise<any> {
    const response = await this.client.get<ApiResponse>(`/api/Lease/${leaseId}/signature-status`);
    return response.data;
  }

  async cancelLeaseSignature(leaseId: string, reason?: string): Promise<void> {
    await this.client.post(`/api/Lease/${leaseId}/cancel-signature`, reason);
  }

  async resendLeaseSignature(leaseId: string): Promise<void> {
    await this.client.post(`/api/Lease/${leaseId}/resend-signature`);
  }
}

export default new LeaseAPI();
