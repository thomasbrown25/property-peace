import apiClient from '../services/apiClient';
import { listingPayload, type ListingForm } from '../features/rentals/listingForm';

export interface Listing {
  id: number;
  propertyId?: number;
  unitId?: number | null;
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
  const response = await apiClient.get<{ success: boolean; data: Listing[] }>('/api/Listing');
  if (!response?.success || !Array.isArray(response.data)) throw new Error('Could not load listings');
  return response.data;
}
export async function getListing(id: number): Promise<Listing> {
  const response = await apiClient.get<{ success: boolean; data: Listing }>(`/api/Listing/${id}`);
  if (!response?.success || !response.data) throw new Error('Could not load listing');
  return response.data;
}
export interface ListingPhoto { id: number; blobUrl: string; isCoverPhoto: boolean }
export interface ListingOption { id: number; name: string; category?: string }
export type ListingPhotoUpload = { uri: string; name: string; type: string };
const unwrapList = <T>(result: { success: boolean; data: T[] }, label: string): T[] => {
  if (!result?.success || !Array.isArray(result.data)) throw new Error(`Could not load ${label}`);
  return result.data;
};
export async function getListingOptions(): Promise<Record<'basicAmenityIds' | 'defaultAmenityIds' | 'customAmenityIds' | 'defaultFeatureIds' | 'customFeatureIds', ListingOption[]>> {
  const paths = ['/api/Amenity/basic', '/api/Amenity/default', '/api/Amenity/custom', '/api/Feature/default', '/api/Feature/custom'];
  const results = await Promise.all(paths.map(path => apiClient.get<{ success: boolean; data: ListingOption[] }>(path)));
  return { basicAmenityIds: unwrapList(results[0], 'basic amenities'), defaultAmenityIds: unwrapList(results[1], 'amenities'),
    customAmenityIds: unwrapList(results[2], 'custom amenities'), defaultFeatureIds: unwrapList(results[3], 'features'), customFeatureIds: unwrapList(results[4], 'custom features') };
}
export async function getListingPhotos(id: number): Promise<ListingPhoto[]> {
  return unwrapList(await apiClient.get<{ success: boolean; data: ListingPhoto[] }>(`/api/ListingImage/${id}`), 'listing photos');
}
export async function uploadListingPhotos(id: number, files: ListingPhotoUpload[]): Promise<void> {
  const body = new FormData();
  files.forEach(file => body.append('files', file as any));
  const response = await apiClient.post<{ success: boolean; message?: string }>(`/api/ListingImage/${id}`, body);
  if (!response?.success) throw new Error(response?.message || 'Could not upload listing photos');
}
export async function deleteListingPhoto(id: number): Promise<void> {
  const result = await apiClient.delete<{ success: boolean; message?: string }>(`/api/ListingImage/${id}`);
  if (!result?.success) throw new Error(result?.message || 'Could not remove photo');
}
export async function setListingCover(listingId: number, photoId: number): Promise<void> {
  const result = await apiClient.put<{ success: boolean; message?: string }>(`/api/ListingImage/${photoId}/set-cover?listingId=${listingId}`);
  if (!result?.success) throw new Error(result?.message || 'Could not set cover photo');
}
export async function saveListing(form: ListingForm, id?: number): Promise<Listing> {
  const values = listingPayload(form, id != null);
  let response: { success: boolean; data: Listing; message?: string };
  if (id != null) {
    const { propertyId, unitId, ...update } = values;
    response = await apiClient.put(`/api/Listing/${id}`, { id, ...update });
  } else {
    // Create binds [FromForm]; update binds [FromBody].
    const body = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((id, index) => body.append(`${key}[${index}]`, String(id)));
      else if (value != null) body.append(key, String(value));
    });
    response = await apiClient.post('/api/Listing', body);
  }
  if (!response?.success || !response.data) throw new Error(response?.message || 'Could not save listing');
  return response.data;
}
