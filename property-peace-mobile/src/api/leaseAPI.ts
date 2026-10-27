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
    // History contains archived contracts only. The property list carries the current
    // projection and all non-deleted contracts (including drafts and successors).
    const [propertiesResponse, historyResponse] = await Promise.all([
      this.client.get<ApiResponse<Array<{ id?: number; name?: string; units?: Array<{ id?: number; name?: string; lease?: Lease; leases?: Lease[] }> }>>>('/api/Property/list'),
      this.client.get<ApiResponse<Lease[]>>('/api/Lease/history'),
    ]);
    if (!Array.isArray(propertiesResponse.data) || !Array.isArray(historyResponse.data)) {
      throw new Error('Invalid property or lease history response');
    }

    const current: Lease[] = [];
    const seen = new Set<string>();
    for (const property of propertiesResponse.data) {
      for (const unit of property.units ?? []) {
        for (const lease of [...(unit.leases ?? []), ...(unit.lease ? [unit.lease] : [])]) {
          const id = Number(lease?.id ?? lease?.Id);
          if (!Number.isSafeInteger(id) || id <= 0 || lease.isDeleted === true || lease.IsDeleted === true || seen.has(String(id))) continue;
          seen.add(String(id));
          current.push({ ...lease, id, propertyName: property.name, propertyId: property.id, unitName: unit.name, unitId: unit.id });
        }
      }
    }
    // Archive IDs belong to a separate table, so do not deduplicate them against live IDs.
    return [...current, ...historyResponse.data.filter(lease => Number(lease?.id ?? lease?.Id) > 0).map(lease => ({ ...lease, archived: true }))];
  }

  async getLease(unitId: string | number): Promise<Lease> {
    const response = await this.client.get<ApiResponse<Lease>>(`/api/Lease/${unitId}`);
    return response.data;
  }

  async getActiveLease(propertyId: string | number): Promise<Lease | null> {
    const response = await this.client.get<ApiResponse<Lease | null>>(`/api/Lease/active/${propertyId}`);
    return response.data ?? null;
  }

  async addOrUpdateLease(leaseData: Record<string, unknown>): Promise<Lease> {
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
