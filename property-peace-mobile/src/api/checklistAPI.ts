import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';
import {
  checklistCollectionPath,
  checklistDetailPath,
  checklistItemImageDeletePath,
  checklistItemImagePath,
} from '../features/checklists/checklistTransportModel';
import { normalizeChecklist, serializeChecklistUpdate } from '../features/checklists/checklistModel';
import type {
  AddChecklistPayload,
  Checklist,
  ChecklistItem,
  ChecklistUploadAsset,
  Id,
  UpdateChecklistPayload,
} from '../features/checklists/checklistTypes';

export type { Checklist, ChecklistItem } from '../features/checklists/checklistTypes';

const isUpdatePayload = (input: Checklist | UpdateChecklistPayload): input is UpdateChecklistPayload =>
  Object.prototype.hasOwnProperty.call(input, 'Id');

class ChecklistAPI {
  async getByProperty(propertyId: Id): Promise<Checklist[]> {
    const response = await apiClient.get<ApiResponse<unknown[]>>(checklistCollectionPath('property', propertyId));
    return (response.data ?? []).map(normalizeChecklist);
  }

  async getByUnit(unitId: Id): Promise<Checklist[]> {
    const response = await apiClient.get<ApiResponse<unknown[]>>(checklistCollectionPath('unit', unitId));
    return (response.data ?? []).map(normalizeChecklist);
  }

  async getById(id: Id): Promise<Checklist> {
    const response = await apiClient.get<ApiResponse<unknown>>(checklistDetailPath(id));
    return normalizeChecklist(response.data);
  }

  async create(payload: AddChecklistPayload): Promise<Checklist> {
    const response = await apiClient.post<ApiResponse<unknown>>('/api/Checklist', payload);
    return normalizeChecklist(response.data);
  }

  async update(id: Id, checklist: Checklist | UpdateChecklistPayload): Promise<Checklist> {
    const payload = isUpdatePayload(checklist) ? checklist : serializeChecklistUpdate(checklist);
    const response = await apiClient.put<ApiResponse<unknown>>(checklistDetailPath(id), payload);
    return normalizeChecklist(response.data);
  }

  async remove(id: Id): Promise<void> {
    await apiClient.delete(checklistDetailPath(id));
  }

  async uploadItemImage(checklistId: Id, itemId: Id, asset: ChecklistUploadAsset): Promise<Checklist> {
    const formData = new FormData();
    formData.append('file', asset as any);
    const response = await apiClient.post<ApiResponse<unknown>>(
      checklistItemImagePath(checklistId, itemId),
      formData,
    );
    return normalizeChecklist(response.data);
  }

  async deleteItemImage(checklistId: Id, itemId: Id, blobName: string): Promise<Checklist> {
    const response = await apiClient.delete<ApiResponse<unknown>>(
      checklistItemImageDeletePath(checklistId, itemId, blobName),
    );
    return normalizeChecklist(response.data);
  }
}

export default new ChecklistAPI();
