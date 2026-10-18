import apiClient from '../services/apiClient';

export interface Listing {
  id: number;
  propertyName: string;
  propertyAddress: string;
  unitName?: string | null;
  listingNumber: string;
  status: string | number;
  monthlyRent: number;
  dateAvailable?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  marketingDescription?: string | null;
  coverImageUrl?: string | null;
  [key: string]: unknown;
}

export async function getListings(): Promise<Listing[]> {
  // apiClient.get returns the response body, not an Axios response.
  const response = await apiClient.get<{ success: boolean; data: Listing[] }>('/api/Listing');
  if (!response?.success || !Array.isArray(response.data)) throw new Error('Could not load listings');
  return response.data;
}
