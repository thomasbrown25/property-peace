import apiClient from '../services/apiClient';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface Lease {
  id: string;
  startDate: string;
  endDate?: string;
  rentAmount: number;
  rentDueDay: number;
  depositAmount?: number;
  propertyName?: string;
  unitName?: string;
  landlordId?: string;
  unit?: {
    id: string;
    name: string;
    property?: {
      id: string;
      name: string;
      propertyType?: string;
      landlordId?: string;
    };
  };
  [key: string]: any;
}

class LeaseAPI {
  private client = apiClient;

  async getMyLease(): Promise<Lease | null> {
    try {
      const response = await this.client.get<ApiResponse<Lease>>('/api/lease/tenant/my-lease');
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error: any) {
      // Handle 404 as "no lease" scenario, not an error
      if (error?.status === 404 || error?.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getAllMyLeases(): Promise<Lease[]> {
    try {
      // Get current lease first to determine organization
      const currentLease = await this.getMyLease();
      if (!currentLease) {
        return [];
      }

      // Get organization ID from current lease or user context
      const organizationId = currentLease.organizationId || (currentLease as any).OrganizationId;
      if (!organizationId) {
        return currentLease ? [currentLease] : [];
      }

      // Try to get lease history by organization
      try {
        const response = await this.client.get<ApiResponse<Lease[]>>(`/api/lease/organization/${organizationId}/history`);
        if (response.success && response.data) {
          return Array.isArray(response.data) ? response.data : [];
        }
      } catch (err) {
        // If endpoint doesn't exist, fall back to just current lease
        console.warn('Could not fetch lease history:', err);
      }

      // Fallback: return current lease if available
      return currentLease ? [currentLease] : [];
    } catch (error) {
      console.warn('Could not fetch all leases:', error);
      return [];
    }
  }
}

export default new LeaseAPI();
export type { Lease };
