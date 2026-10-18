import apiClient from '../services/apiClient';
import type { ApiResponse } from '../types';

export interface Vendor {
  id: number;
  name: string;
  businessName?: string | null;
  category?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  notes?: string | null;
  isActive: boolean;
  isReadyForAssignment: boolean;
  maintenanceRequestCount: number;
  [key: string]: unknown;
}

export type VendorInput = {
  name: string;
  businessName?: string;
  category?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

const unwrap = <T>(response: ApiResponse<T> | T): T =>
  response && typeof response === 'object' && 'data' in response ? (response as ApiResponse<T>).data : response as T;

class VendorAPI {
  async getVendors(): Promise<Vendor[]> {
    const data = unwrap(await apiClient.get<ApiResponse<Vendor[]> | Vendor[]>('/api/vendor?landlordId=0&includeInactive=true'));
    if (!Array.isArray(data)) throw new Error('Vendor directory response was invalid');
    return data;
  }

  async addVendor(input: VendorInput): Promise<Vendor> {
    return unwrap(await apiClient.post<ApiResponse<Vendor>>('/api/vendor', { ...input, landlordId: 0 }));
  }
}

export default new VendorAPI();
