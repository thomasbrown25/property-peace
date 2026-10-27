import apiClient from '../services/apiClient';
import type { ApiResponse } from '../types';
import type { Unit } from './propertyAPI';
import type { unitPayload } from '../features/properties/propertyForms';
import type { RentalMode, RentalModePreflight } from '../features/properties/rentalMode';

type UnitPayload = ReturnType<typeof unitPayload>;

class UnitAPI {
  async rentalModePreflight(unitId: string | number, targetMode: RentalMode): Promise<RentalModePreflight> {
    const response = await apiClient.get<ApiResponse<RentalModePreflight>>(`/api/Unit/${unitId}/rental-mode/preflight`, { params: { targetMode } });
    return response.data;
  }

  async changeRentalMode(unitId: string | number, targetMode: RentalMode): Promise<RentalModePreflight> {
    const response = await apiClient.post<ApiResponse<RentalModePreflight>>(`/api/Unit/${unitId}/rental-mode`, { targetMode, confirmed: true });
    return response.data;
  }
  async saveUnit(unit: UnitPayload): Promise<Unit> {
    const response = await apiClient.post<ApiResponse<Unit>>('/api/unit', unit);
    return response.data;
  }

  async bulkCreate(propertyId: string | number, units: UnitPayload[]): Promise<Unit[]> {
    const response = await apiClient.post<ApiResponse<Unit[]>>('/api/unit/bulk', { propertyId: Number(propertyId), units });
    return response.data;
  }
}

export default new UnitAPI();