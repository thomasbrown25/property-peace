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
  description?: string | null;
  alternatePhone?: string | null;
  licenseNumber?: string | null;
  specialties?: string | null;
  // Tax ID is intentionally omitted from API reads.
  requires1099?: boolean;
  createdAt?: string;
  updatedAt?: string;
  expenseCount?: number;
  totalExpenseAmount?: number;
  isActive: boolean;
  isReadyForAssignment: boolean;
  maintenanceRequestCount: number;
  [key: string]: unknown;
}

export interface VendorMaintenance {
  id: number;
  orderNumber?: string | null;
  title: string;
  propertyName: string;
  unitName?: string | null;
  status: string;
  priority: string;
  createdAt: string;
  assignedAt?: string | null;
  completedAt?: string | null;
  isCurrentAssignment: boolean;
  wasReassigned: boolean;
}

export type VendorInput = {
  name: string;
  businessName?: string;
  category?: string;
  email?: string;
  phone?: string;
  notes?: string;
  description?: string;
  specialties?: string;
  alternatePhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId?: string;
  licenseNumber?: string;
  requires1099?: boolean;
};

const unwrap = <T>(response: ApiResponse<T> | T): T =>
  response && typeof response === 'object' && 'data' in response ? (response as ApiResponse<T>).data : response as T;

class VendorAPI {
  async getVendors(): Promise<Vendor[]> {
    const data = unwrap(await apiClient.get<ApiResponse<Vendor[]> | Vendor[]>('/api/vendor?landlordId=0&includeInactive=true'));
    if (!Array.isArray(data)) throw new Error('Vendor directory response was invalid');
    return data;
  }

  async getVendor(id: string): Promise<Vendor> {
    const data = unwrap(await apiClient.get<ApiResponse<Vendor>>(`/api/vendor/${encodeURIComponent(id)}`));
    if (!data || typeof data !== 'object' || !data.id) throw new Error('Vendor response was invalid');
    return data;
  }

  async getMaintenance(id: string): Promise<VendorMaintenance[]> {
    const data = unwrap(await apiClient.get<ApiResponse<VendorMaintenance[]>>(`/api/vendor/${encodeURIComponent(id)}/maintenance`));
    if (!Array.isArray(data)) throw new Error('Vendor maintenance response was invalid');
    return data;
  }

  async patchVendor(id: string, changes: Record<string, string | null>): Promise<Vendor> {
    return unwrap(await apiClient.request<ApiResponse<Vendor>>('PATCH', `/api/vendor/${encodeURIComponent(id)}`, changes));
  }

  async addVendor(input: VendorInput): Promise<Vendor> {
    return unwrap(await apiClient.post<ApiResponse<Vendor>>('/api/vendor', { ...input, landlordId: 0 }));
  }
}

export default new VendorAPI();
