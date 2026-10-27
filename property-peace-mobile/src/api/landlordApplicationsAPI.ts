import apiClient from '../services/apiClient';
import { applicationPayload, type ApplicationForm } from '../features/rentals/applicationForm';

export interface RentalApplication {
  id: number;
  status: string | number;
  statusName?: string;
  propertyName?: string | null;
  unitName?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  desiredMoveInDate?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  monthlyIncome?: number | null;
  numberOfOccupants?: number | null;
  additionalNotes?: string | null;
  [key: string]: unknown;
}

export async function getLandlordApplications(landlordId: string): Promise<RentalApplication[]> {
  // The endpoint validates the requested ID against the authenticated user and scopes by organization.
  const response = await apiClient.get<{ success: boolean; data: RentalApplication[] }>(`/api/Application/landlord/${encodeURIComponent(landlordId)}`);
  if (!response?.success || !Array.isArray(response.data)) throw new Error('Could not load applications');
  return response.data;
}

export async function getApplication(id: number): Promise<RentalApplication> {
  const response = await apiClient.get<{ success: boolean; data: RentalApplication }>(`/api/Application/${id}`);
  if (!response?.success || !response.data) throw new Error('Could not load application');
  return response.data;
}

export async function saveApplication(form: ApplicationForm, id?: number): Promise<RentalApplication> {
  const response = id == null
    ? await apiClient.post<{ success: boolean; data: RentalApplication; message?: string }>('/api/Application', applicationPayload(form, false))
    : await apiClient.put<{ success: boolean; data: RentalApplication; message?: string }>(`/api/Application/${id}`, { id, ...applicationPayload(form, true) });
  if (!response?.success || !response.data) throw new Error(response?.message || 'Could not save application');
  return response.data;
}
