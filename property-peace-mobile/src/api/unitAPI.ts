import apiClient from '../services/apiClient';
import type { ApiResponse } from '../types';
import type { Unit } from './propertyAPI';
import type { unitPayload } from '../features/properties/propertyForms';

type UnitPayload = ReturnType<typeof unitPayload>;

class UnitAPI {
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