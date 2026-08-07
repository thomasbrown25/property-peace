import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';

export interface ChecklistItem {
  id?: string | number;
  name?: string;
  description?: string;
  category?: string;
  condition?: string;
  notes?: string;
  hasDamage?: boolean;
  damageDescription?: string;
  photoBlobNames?: string[];
  photoBlobUrls?: string[];
  isChecked?: boolean;
  checkedAt?: string | null;
  sortOrder?: number;
  [key: string]: any;
}

export interface Checklist {
  id?: string | number;
  title?: string;
  checklistType?: number | string;
  propertyId?: string | number;
  unitId?: string | number;
  leaseId?: string | number;
  inspectionDate?: string;
  completedAt?: string | null;
  isCompleted?: boolean;
  generalNotes?: string;
  conditionNotes?: string;
  items?: ChecklistItem[];
  [key: string]: any;
}

const value = <T>(source: any, camel: string, pascal: string, fallback?: T): T =>
  (source?.[camel] ?? source?.[pascal] ?? fallback) as T;

export const normalizeChecklistItem = (item: any): ChecklistItem => ({
  ...item,
  id: value(item, 'id', 'Id'),
  name: value(item, 'name', 'Name', ''),
  description: value(item, 'description', 'Description', ''),
  category: value(item, 'category', 'Category', ''),
  condition: value(item, 'condition', 'Condition', ''),
  notes: value(item, 'notes', 'Notes', ''),
  hasDamage: value(item, 'hasDamage', 'HasDamage', false),
  damageDescription: value(item, 'damageDescription', 'DamageDescription', ''),
  photoBlobNames: value(item, 'photoBlobNames', 'PhotoBlobNames', []),
  photoBlobUrls: value(item, 'photoBlobUrls', 'PhotoBlobUrls', []),
  isChecked: value(item, 'isChecked', 'IsChecked', false),
  checkedAt: value(item, 'checkedAt', 'CheckedAt', null),
  sortOrder: value(item, 'sortOrder', 'SortOrder', 0),
});

export const normalizeChecklist = (item: any): Checklist => ({
  ...item,
  id: value(item, 'id', 'Id'),
  title: value(item, 'title', 'Title', 'Property checklist'),
  checklistType: value(item, 'checklistType', 'ChecklistType'),
  propertyId: value(item, 'propertyId', 'PropertyId'),
  unitId: value(item, 'unitId', 'UnitId'),
  leaseId: value(item, 'leaseId', 'LeaseId'),
  inspectionDate: value(item, 'inspectionDate', 'InspectionDate'),
  completedAt: value(item, 'completedAt', 'CompletedAt', null),
  isCompleted: value(item, 'isCompleted', 'IsCompleted', false),
  generalNotes: value(item, 'generalNotes', 'GeneralNotes', ''),
  conditionNotes: value(item, 'conditionNotes', 'ConditionNotes', ''),
  items: value<any[]>(item, 'items', 'Items', []).map(normalizeChecklistItem),
});

class ChecklistAPI {
  async getByProperty(propertyId: string | number): Promise<Checklist[]> {
    const response = await apiClient.get<ApiResponse<any[]>>(`/api/Checklist/property/${propertyId}`);
    return (response.data || []).map(normalizeChecklist);
  }

  async getById(id: string | number): Promise<Checklist> {
    const response = await apiClient.get<ApiResponse<any>>(`/api/Checklist/${id}`);
    return normalizeChecklist(response.data);
  }

  async update(id: string | number, checklist: Checklist): Promise<Checklist> {
    const items = (checklist.items || []).map((item) => ({
      id: item.id ?? null,
      name: item.name ?? '',
      description: item.description ?? '',
      category: item.category ?? '',
      condition: item.condition ?? '',
      notes: item.notes ?? '',
      hasDamage: item.hasDamage ?? false,
      damageDescription: item.damageDescription ?? '',
      photoBlobNames: item.photoBlobNames ?? [],
      isChecked: item.isChecked ?? false,
      checkedAt: item.checkedAt ?? null,
      sortOrder: item.sortOrder ?? 0,
    }));
    const payload = {
      id: Number(id),
      title: checklist.title,
      leaseId: checklist.leaseId ?? null,
      inspectionDate: checklist.inspectionDate ?? null,
      completedAt: checklist.completedAt ?? null,
      isCompleted: checklist.isCompleted ?? false,
      generalNotes: checklist.generalNotes ?? '',
      conditionNotes: checklist.conditionNotes ?? '',
      items,
    };
    const response = await apiClient.put<ApiResponse<any>>(`/api/Checklist/${id}`, payload);
    return normalizeChecklist(response.data);
  }
}

export default new ChecklistAPI();
