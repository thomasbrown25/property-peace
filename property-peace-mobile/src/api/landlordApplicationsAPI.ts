import apiClient from '../services/apiClient';

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
