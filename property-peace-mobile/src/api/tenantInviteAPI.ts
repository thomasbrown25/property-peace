import apiClient from '../services/apiClient';
import type { ApiResponse } from '../types';

export interface TenantInvite {
  id: number;
  tenantId: number;
  email: string;
  expiresAt: string;
  isUsed: boolean;
  [key: string]: any;
}

const requireSuccess = <T>(response: ApiResponse<T>): T => {
  if (!response?.success) throw new Error(response?.message || 'Invitation request failed.');
  return response.data;
};

class TenantInviteAPI {
  async getInvitesByTenantId(tenantId: string): Promise<TenantInvite[]> {
    const response = await apiClient.get<ApiResponse<TenantInvite[]>>(`/api/TenantInvite/tenant/${tenantId}`);
    const invites = requireSuccess(response);
    if (!Array.isArray(invites)) throw new Error('Could not load portal invitations.');
    return invites;
  }

  async createInvite(tenantId: string, email: string): Promise<ApiResponse<TenantInvite>> {
    const response = await apiClient.post<ApiResponse<TenantInvite>>('/api/TenantInvite', { tenantId: Number(tenantId), email });
    requireSuccess(response);
    return response;
  }

  async resendInvite(inviteId: number): Promise<void> {
    const response = await apiClient.post<ApiResponse<boolean>>(`/api/TenantInvite/${inviteId}/resend`);
    if (requireSuccess(response) !== true) throw new Error('Could not resend portal invitation.');
  }
}

export default new TenantInviteAPI();
