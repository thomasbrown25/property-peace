import apiClient from '../services/apiClient';

export type SearchResult = {
  properties: { id: number; name: string; address?: string; propertyType?: string }[];
  tenants: { id: number; firstname: string; lastname: string; propertyName?: string; unitName?: string; email?: string }[];
  leases: { id: number; propertyName: string; unitName?: string; tenantNames?: string[]; isActive?: boolean }[];
};

export async function globalSearch(query: string): Promise<SearchResult> {
  const response = await apiClient.get<{ success: boolean; data: SearchResult }>(
    `/api/search/global?query=${encodeURIComponent(query.trim())}&maxResults=10`,
  );
  if (!response.success || !response.data) throw new Error('Search unavailable');
  return response.data;
}
