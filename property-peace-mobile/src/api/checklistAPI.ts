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
import {
  normalizeTransitionChecklist,
  type LeaseTransitionChecklist,
  type LeaseTransitionChecklistItem,
  type LeaseTransitionPhase,
} from '../features/checklists/leaseTransitionChecklistModel';

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

  async getConditionReports(scope: { propertyId: Id; unitId?: Id; leaseId?: Id | null }): Promise<Checklist[]> {
    const params = new URLSearchParams({ propertyId: String(scope.propertyId) });
    if (scope.unitId != null) params.set('unitId', String(scope.unitId));
    if (scope.leaseId != null) params.set('leaseId', String(scope.leaseId));
    const response = await apiClient.get<ApiResponse<unknown[]>>(`/api/condition-reports?${params.toString()}`);
    return (response.data ?? []).map(normalizeChecklist);
  }

  async createConditionReport(payload: AddChecklistPayload & { requestId: string }): Promise<Checklist> {
    const response = await apiClient.post<ApiResponse<unknown>>('/api/condition-reports', payload);
    return normalizeChecklist(response.data);
  }

  async getTransitionChecklists(scope: { propertyId: Id; unitId?: Id; leaseId?: Id | null }): Promise<LeaseTransitionChecklist[]> {
    const params = new URLSearchParams({ propertyId: String(scope.propertyId) });
    if (scope.unitId != null) params.set('unitId', String(scope.unitId));
    if (scope.leaseId != null) params.set('leaseId', String(scope.leaseId));
    const response = await apiClient.get<ApiResponse<unknown[]>>(`/api/lease-transition-checklists?${params.toString()}`);
    return (response.data ?? []).map(normalizeTransitionChecklist);
  }

  async getTransitionChecklistById(id: Id): Promise<LeaseTransitionChecklist> {
    const response = await apiClient.get<ApiResponse<unknown>>(`/api/lease-transition-checklists/${encodeURIComponent(String(id))}`);
    return normalizeTransitionChecklist(response.data);
  }

  async createTransitionChecklist(input: { propertyId: Id; unitId?: Id; leaseId?: Id | null; phase: LeaseTransitionPhase; requestId?: string }): Promise<LeaseTransitionChecklist> {
    const requestId = input.requestId ?? `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const response = await apiClient.post<ApiResponse<unknown>>('/api/lease-transition-checklists', { ...input, requestId });
    return normalizeTransitionChecklist(response.data);
  }

  async updateTransitionItem(checklistId: Id, item: Pick<LeaseTransitionChecklistItem, 'key' | 'status' | 'notApplicableReason'>): Promise<LeaseTransitionChecklist> {
    const payload = { status: item.status, ...(item.notApplicableReason ? { notApplicableReason: item.notApplicableReason } : {}) };
    const response = await apiClient.put<ApiResponse<unknown>>(`/api/lease-transition-checklists/${encodeURIComponent(String(checklistId))}/items/${encodeURIComponent(item.key)}`, payload);
    return normalizeTransitionChecklist(response.data);
  }

  async linkConditionReport(checklistId: Id, conditionReportId?: Id | null): Promise<LeaseTransitionChecklist> {
    const response = await apiClient.put<ApiResponse<unknown>>(`/api/lease-transition-checklists/${encodeURIComponent(String(checklistId))}/condition-report`, conditionReportId == null ? {} : { conditionReportId });
    return normalizeTransitionChecklist(response.data);
  }

  async detachConditionReport(checklistId: Id): Promise<LeaseTransitionChecklist> {
    const response = await apiClient.delete<ApiResponse<unknown>>(`/api/lease-transition-checklists/${encodeURIComponent(String(checklistId))}/condition-report`);
    return normalizeTransitionChecklist(response.data);
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
