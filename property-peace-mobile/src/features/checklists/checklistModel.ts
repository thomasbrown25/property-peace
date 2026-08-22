import type {
  Checklist,
  ChecklistCondition,
  ChecklistCycle,
  ChecklistItem,
  ChecklistRoom,
  ChecklistUploadAsset,
  ImagePickerAssetLike,
  Id,
  UpdateChecklistPayload,
} from './checklistTypes';

export const MOVE_IN_CHECKLIST = 40;
export const MOVE_OUT_CHECKLIST = 41;

export const CHECKLIST_CONDITIONS: ReadonlyArray<{ value: ChecklistCondition; label: string }> = [
  { value: 'Good', label: 'Good – No issues' },
  { value: 'NC', label: 'NC – Needs Cleaning' },
  { value: 'NP', label: 'NP – Needs Painting' },
  { value: 'NR', label: 'NR – Needs Repair' },
  { value: 'NSC', label: 'NSC – Needs Spot Cleaning' },
  { value: 'NSP', label: 'NSP – Needs Spot Painting' },
  { value: 'RP', label: 'RP – Needs Replacing' },
];

const value = <T>(source: any, camel: string, pascal: string, fallback: T): T =>
  (source?.[camel] ?? source?.[pascal] ?? fallback) as T;

export const normalizeChecklistItem = (source: any): ChecklistItem => ({
  id: value<Id | undefined>(source, 'id', 'Id', undefined),
  name: value(source, 'name', 'Name', ''),
  description: value(source, 'description', 'Description', ''),
  category: value(source, 'category', 'Category', ''),
  condition: value<ChecklistCondition | '' | null>(source, 'condition', 'Condition', ''),
  notes: value(source, 'notes', 'Notes', ''),
  hasDamage: value(source, 'hasDamage', 'HasDamage', false),
  damageDescription: value(source, 'damageDescription', 'DamageDescription', ''),
  photoBlobNames: value<string[]>(source, 'photoBlobNames', 'PhotoBlobNames', []),
  photoBlobUrls: value<string[]>(source, 'photoBlobUrls', 'PhotoBlobUrls', []),
  isChecked: value(source, 'isChecked', 'IsChecked', false),
  checkedAt: value<string | null>(source, 'checkedAt', 'CheckedAt', null),
  sortOrder: value(source, 'sortOrder', 'SortOrder', 0),
});

export const normalizeChecklist = (source: any): Checklist => ({
  id: value<Id | undefined>(source, 'id', 'Id', undefined),
  checklistType: value<number | string | undefined>(source, 'checklistType', 'ChecklistType', undefined),
  checklistTypeName: value(source, 'checklistTypeName', 'ChecklistTypeName', ''),
  propertyId: value<Id | undefined>(source, 'propertyId', 'PropertyId', undefined),
  propertyName: value(source, 'propertyName', 'PropertyName', ''),
  unitId: value<Id | undefined>(source, 'unitId', 'UnitId', undefined),
  unitName: value(source, 'unitName', 'UnitName', ''),
  leaseId: value<Id | undefined>(source, 'leaseId', 'LeaseId', undefined),
  counterpartChecklistId: value<Id | undefined>(source, 'counterpartChecklistId', 'CounterpartChecklistId', undefined),
  leaseStartDate: value(source, 'leaseStartDate', 'LeaseStartDate', ''),
  leaseEndDate: value(source, 'leaseEndDate', 'LeaseEndDate', ''),
  tenantId: value<Id | undefined>(source, 'tenantId', 'TenantId', undefined),
  tenantName: value(source, 'tenantName', 'TenantName', ''),
  title: value(source, 'title', 'Title', 'Property checklist'),
  inspectionDate: value<string | null>(source, 'inspectionDate', 'InspectionDate', null),
  completedAt: value<string | null>(source, 'completedAt', 'CompletedAt', null),
  isCompleted: value(source, 'isCompleted', 'IsCompleted', false),
  generalNotes: value(source, 'generalNotes', 'GeneralNotes', ''),
  conditionNotes: value(source, 'conditionNotes', 'ConditionNotes', ''),
  roomNames: value<string[]>(source, 'roomNames', 'RoomNames', []),
  items: value<any[]>(source, 'items', 'Items', []).map(normalizeChecklistItem),
  createdAt: value(source, 'createdAt', 'CreatedAt', ''),
  updatedAt: value(source, 'updatedAt', 'UpdatedAt', ''),
});

const normalizedType = (checklist: Partial<Checklist>) =>
  `${checklist.checklistType ?? ''} ${checklist.checklistTypeName ?? ''}`.toLowerCase().replaceAll('-', '');

export const isMoveInChecklist = (checklist: Partial<Checklist>) =>
  Number(checklist.checklistType) === MOVE_IN_CHECKLIST || normalizedType(checklist).includes('movein');

export const isMoveOutChecklist = (checklist: Partial<Checklist>) =>
  Number(checklist.checklistType) === MOVE_OUT_CHECKLIST || normalizedType(checklist).includes('moveout');

const sameId = (left?: Id | null, right?: Id | null) =>
  left != null && right != null && String(left) === String(right);

export const buildConditionCycles = (checklists: Checklist[]): ChecklistCycle[] => {
  const moveIns = checklists.filter(isMoveInChecklist);
  const moveOuts = checklists.filter(isMoveOutChecklist);
  const unusedMoveOuts = new Set(moveOuts.map((item) => String(item.id)));
  const cycles: ChecklistCycle[] = moveIns.map((moveIn) => {
    const moveOut = moveOuts.find((candidate) => unusedMoveOuts.has(String(candidate.id)) && (
      sameId(moveIn.counterpartChecklistId, candidate.id)
      || sameId(candidate.counterpartChecklistId, moveIn.id)
      || sameId(moveIn.leaseId, candidate.leaseId)
    )) ?? null;
    if (moveOut) unusedMoveOuts.delete(String(moveOut.id));
    return { id: `in-${String(moveIn.id)}`, moveIn, moveOut };
  });
  moveOuts.filter((item) => unusedMoveOuts.has(String(item.id))).forEach((moveOut) => {
    cycles.push({ id: `out-${String(moveOut.id)}`, moveIn: null, moveOut });
  });
  return cycles;
};

const roomKey = (name?: string | null) => (name?.trim() || 'General').toLowerCase();
const roomLabel = (name?: string | null) => name?.trim() || 'General';

export const groupChecklistRooms = (checklist: Pick<Checklist, 'roomNames' | 'items'>): ChecklistRoom[] => {
  const grouped = new Map<string, ChecklistRoom>();
  const ensure = (name?: string | null) => {
    const key = roomKey(name);
    if (!grouped.has(key)) grouped.set(key, { name: roomLabel(name), items: [] });
    return grouped.get(key)!;
  };
  (checklist.roomNames ?? []).forEach((name) => ensure(name));
  (checklist.items ?? []).forEach((item) => ensure(item.category).items.push(item));
  return [...grouped.values()];
};

export const getChecklistProgress = (checklist: Pick<Checklist, 'items'>) => {
  const total = checklist.items.length;
  const done = checklist.items.filter((item) => Boolean(item.condition)).length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0, complete: total > 0 && done === total };
};

export const withItemCondition = (
  checklist: Checklist,
  itemId: Id,
  condition: ChecklistCondition | null,
  now: string,
): Checklist => {
  const items = checklist.items.map((item) => sameId(item.id, itemId)
    ? { ...item, condition: condition ?? '', isChecked: Boolean(condition), checkedAt: condition ? now : null }
    : item);
  const complete = items.length > 0 && items.every((item) => Boolean(item.condition));
  return {
    ...checklist,
    items,
    isCompleted: complete,
    completedAt: complete ? checklist.completedAt || now : null,
  };
};

const existingRoomNames = (checklist: Checklist) => groupChecklistRooms(checklist).map(({ name }) => name);

export const addChecklistRoom = (checklist: Checklist, proposedName: string): Checklist => {
  const name = proposedName.trim();
  if (!name) throw new Error('Room name is required');
  if (existingRoomNames(checklist).some((room) => roomKey(room) === roomKey(name))) {
    throw new Error('That room already exists');
  }
  return { ...checklist, roomNames: [...(checklist.roomNames ?? []), name] };
};

export const renameChecklistRoom = (checklist: Checklist, currentName: string, proposedName: string): Checklist => {
  const nextName = proposedName.trim();
  if (!nextName) throw new Error('Room name is required');
  if (existingRoomNames(checklist).some((room) => roomKey(room) !== roomKey(currentName) && roomKey(room) === roomKey(nextName))) {
    throw new Error('That room already exists');
  }
  const roomNames = (checklist.roomNames ?? []).map((name) => roomKey(name) === roomKey(currentName) ? nextName : name);
  if (!roomNames.some((name) => roomKey(name) === roomKey(nextName))) roomNames.push(nextName);
  return {
    ...checklist,
    roomNames,
    items: checklist.items.map((item) => roomKey(item.category) === roomKey(currentName)
      ? { ...item, category: nextName }
      : item),
  };
};

export const addChecklistItem = (checklist: Checklist, roomName: string, proposedName: string): Checklist => {
  const name = proposedName.trim();
  if (!name) throw new Error('Item name is required');
  const maxSort = checklist.items.length ? Math.max(...checklist.items.map((item) => item.sortOrder ?? 0)) : 999;
  return {
    ...checklist,
    items: [...checklist.items, {
      name,
      category: roomLabel(roomName),
      condition: '',
      notes: '',
      hasDamage: false,
      damageDescription: '',
      photoBlobNames: [],
      photoBlobUrls: [],
      isChecked: false,
      checkedAt: null,
      sortOrder: Math.max(maxSort + 1, 1000),
    }],
  };
};

export const removeCustomChecklistItem = (checklist: Checklist, itemId: Id): Checklist => {
  const item = checklist.items.find((candidate) => sameId(candidate.id, itemId));
  if (!item) throw new Error('Checklist item was not found');
  if ((item.sortOrder ?? 0) < 1000) throw new Error('Default items cannot be removed');
  return { ...checklist, items: checklist.items.filter((candidate) => !sameId(candidate.id, itemId)) };
};

const serializeChecklistItem = (item: ChecklistItem) => ({
  Id: item.id ?? null,
  Name: item.name ?? '',
  Description: item.description ?? '',
  Category: item.category ?? '',
  Condition: item.condition || null,
  Notes: item.notes ?? '',
  HasDamage: item.hasDamage ?? false,
  DamageDescription: item.damageDescription ?? '',
  PhotoBlobNames: item.photoBlobNames ?? [],
  PhotoBlobUrls: item.photoBlobUrls ?? [],
  IsChecked: item.isChecked ?? false,
  CheckedAt: item.checkedAt ?? null,
  SortOrder: item.sortOrder ?? 0,
});

export const serializeChecklistUpdate = (checklist: Checklist): UpdateChecklistPayload => ({
  Id: Number(checklist.id),
  Title: checklist.title,
  LeaseId: checklist.leaseId ?? null,
  CounterpartChecklistId: checklist.counterpartChecklistId ?? null,
  InspectionDate: checklist.inspectionDate ?? null,
  CompletedAt: checklist.completedAt ?? null,
  IsCompleted: checklist.isCompleted ?? false,
  GeneralNotes: checklist.generalNotes ?? '',
  ConditionNotes: checklist.conditionNotes ?? '',
  RoomNames: checklist.roomNames ?? [],
  Items: checklist.items.map(serializeChecklistItem),
});

export const toChecklistUploadAsset = (asset: ImagePickerAssetLike): ChecklistUploadAsset => ({
  uri: asset.uri,
  name: asset.fileName?.trim() || 'checklist-photo.jpg',
  type: asset.mimeType?.trim() || 'image/jpeg',
});
