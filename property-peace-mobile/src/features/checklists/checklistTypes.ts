export type Id = string | number;

export type ChecklistCondition = 'Good' | 'NC' | 'NP' | 'NR' | 'NSC' | 'NSP' | 'RP';

export interface ChecklistProperty {
  id?: Id;
  name?: string;
  streetAddress?: string;
  address?: string;
  city?: string;
  state?: string;
  propertyType?: string;
  [key: string]: unknown;
}

export interface ChecklistUnit {
  id?: Id;
  name?: string;
  lease?: ChecklistLease | null;
  activeLease?: ChecklistLease | null;
  [key: string]: unknown;
}

export interface ChecklistLease {
  id?: Id;
  unitId?: Id;
  propertyId?: Id;
  isActive?: boolean;
  tenants?: Array<{ id?: Id; firstName?: string; lastName?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface ChecklistHome {
  propertyId: string;
  propertyName: string;
  propertyType?: string;
  unitId?: string;
  unitName?: string;
}

export interface ChecklistItem {
  id?: Id;
  name: string;
  description?: string;
  category?: string;
  condition?: ChecklistCondition | '' | null;
  notes?: string;
  hasDamage?: boolean;
  damageDescription?: string;
  photoBlobNames?: string[];
  photoBlobUrls?: string[];
  isChecked?: boolean;
  checkedAt?: string | null;
  sortOrder?: number;
}

export interface Checklist {
  id?: Id;
  checklistType?: number | string;
  checklistTypeName?: string;
  propertyId?: Id;
  propertyName?: string;
  unitId?: Id;
  unitName?: string;
  leaseId?: Id;
  counterpartChecklistId?: Id;
  leaseStartDate?: string;
  leaseEndDate?: string;
  tenantId?: Id;
  tenantName?: string;
  title?: string;
  inspectionDate?: string | null;
  completedAt?: string | null;
  isCompleted?: boolean;
  generalNotes?: string;
  conditionNotes?: string;
  roomNames?: string[];
  items: ChecklistItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ChecklistRoom {
  name: string;
  items: ChecklistItem[];
}

export interface ChecklistCycle {
  id: string;
  moveIn: Checklist | null;
  moveOut: Checklist | null;
}

export interface ChecklistUploadAsset {
  uri: string;
  name: string;
  type: string;
}

export interface ImagePickerAssetLike {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export interface AddChecklistItemPayload {
  Name: string;
  Description?: string;
  Category?: string;
  Condition?: ChecklistCondition | null;
  Notes?: string;
  HasDamage?: boolean;
  DamageDescription?: string;
  SortOrder: number;
}

export interface AddChecklistPayload {
  ChecklistType: number;
  PropertyId: number;
  UnitId: number | null;
  LeaseId: Id | null;
  TenantId: Id | null;
  CounterpartChecklistId: Id | null;
  Title: string;
  InspectionDate: string | null;
  RoomNames: string[];
  Items: AddChecklistItemPayload[];
}

export interface UpdateChecklistPayload {
  Id: number;
  Title?: string;
  LeaseId?: Id | null;
  CounterpartChecklistId?: Id | null;
  InspectionDate?: string | null;
  CompletedAt?: string | null;
  IsCompleted?: boolean;
  GeneralNotes?: string;
  ConditionNotes?: string;
  RoomNames?: string[];
  Items?: Array<{
    Id: Id | null;
    Name: string;
    Description: string;
    Category: string;
    Condition: ChecklistCondition | null;
    Notes: string;
    HasDamage: boolean;
    DamageDescription: string;
    PhotoBlobNames: string[];
    PhotoBlobUrls: string[];
    IsChecked: boolean;
    CheckedAt: string | null;
    SortOrder: number;
  }>;
}
