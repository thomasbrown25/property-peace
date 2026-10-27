import apiClient from '../services/apiClient';
import type { ApiResponse } from '../types';

export interface CollectionRequirements {
  available: boolean;
  feePolicyConsentVersion: string | null;
  feePolicyUrl: string | null;
  identityEnabled: boolean;
  reasonCode: string | null;
}
export type CollectionStatus = 'draft' | 'submitted' | 'identityPending' | 'identityVerified' | 'underReview' | 'payoutApproved' | 'suspended' | 'rejected';
export interface CollectionApplication {
  id: number;
  status: CollectionStatus;
  propertyIds: number[];
  rowVersion: number;
  authorityAttested: boolean;
  feePolicyConsentVersion: string | null;
  submittedAt: string | null;
  nextSteps: string[];
}
const path = '/api/short-stay/collection-applications';
const unwrap = <T>(response: ApiResponse<T>, label: string): T => {
  if (!response?.success) throw new Error(response?.message || `Could not ${label}`);
  return response.data;
};
const noStore = { headers: { 'Cache-Control': 'no-store' } };
const applicationPath = (id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid application');
  return `${path}/${id}`;
};
const collectionAPI = {
  async requirements() { return unwrap(await apiClient.get<ApiResponse<CollectionRequirements>>(`${path}/requirements`, noStore), 'load requirements'); },
  async applications() { return unwrap(await apiClient.get<ApiResponse<CollectionApplication[]>>(path, noStore), 'load applications'); },
  async saveDraft(propertyIds: number[], feePolicyConsentVersion: string) {
    return unwrap(await apiClient.put<ApiResponse<CollectionApplication>>(`${path}/draft`, { propertyIds, authorityAttested: true, feePolicyConsentVersion }), 'save application');
  },
  async submit() { return unwrap(await apiClient.post<ApiResponse<CollectionApplication>>(`${path}/submit`), 'submit application'); },
  // A null response means Stripe has no actionable hosted link (processing/verified/expired).
  async identitySession(id: number) { return unwrap(await apiClient.post<ApiResponse<{ url: string } | null>>(`${applicationPath(id)}/identity-session`, undefined, noStore), 'start identity verification'); },
  async identityRefresh(id: number) { return unwrap(await apiClient.post<ApiResponse<null>>(`${applicationPath(id)}/identity-refresh`, undefined, noStore), 'refresh identity verification'); },
};
export default collectionAPI;
