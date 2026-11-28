import type { Checklist, Id } from './checklistTypes';

export type LeaseTransitionPhase = 'moveIn' | 'moveOut';
export type LeaseTransitionItemStatus = 'pending' | 'done' | 'notApplicable';

export type LeaseTransitionChecklistItem = {
  key: string;
  label: string;
  status: LeaseTransitionItemStatus;
  completedAt?: string | null;
  notApplicableReason?: string | null;
  required?: boolean;
  allowNotApplicable?: boolean;
  sortOrder?: number;
};

export type LeaseTransitionChecklist = {
  id?: Id;
  propertyId: Id;
  unitId?: Id | null;
  unitName?: string;
  leaseId?: Id | null;
  phase: LeaseTransitionPhase;
  title?: string;
  items: LeaseTransitionChecklistItem[];
  conditionReport?: Checklist | null;
  completedAt?: string | null;
};

const get = <T>(source: any, camel: string, pascal: string, fallback: T): T =>
  (source?.[camel] ?? source?.[pascal] ?? fallback) as T;
const id = (value: unknown): Id | undefined => value == null ? undefined : value as Id;

export const normalizeTransitionChecklistItem = (source: any): LeaseTransitionChecklistItem => {
  const allowNotApplicable = get(source, 'allowNotApplicable', 'AllowNotApplicable', false);
  return {
    key: get(source, 'key', 'Key', ''),
    label: get(source, 'label', 'Label', ''),
    status: get<LeaseTransitionItemStatus>(source, 'status', 'Status', 'pending'),
    completedAt: get<string | null>(source, 'completedAt', 'CompletedAt', null),
    notApplicableReason: get<string | null>(source, 'notApplicableReason', 'NotApplicableReason', null),
    // The API exposes AllowNotApplicable rather than an IsRequired field.
    required: get(source, 'required', 'IsRequired', !allowNotApplicable),
    allowNotApplicable,
    sortOrder: get(source, 'sortOrder', 'SortOrder', 0),
  };
};

export const normalizeTransitionChecklist = (source: any): LeaseTransitionChecklist => {
  const reportSource = source?.conditionReport ?? source?.ConditionReport ?? null;
  return {
    id: id(source?.id ?? source?.Id),
    propertyId: get(source, 'propertyId', 'PropertyId', ''),
    unitId: get<Id | null>(source, 'unitId', 'UnitId', null),
    unitName: get(source, 'unitName', 'UnitName', ''),
    leaseId: get<Id | null>(source, 'leaseId', 'LeaseId', null),
    phase: get<LeaseTransitionPhase>(source, 'phase', 'Phase', 'moveIn'),
    title: get(source, 'title', 'Title', ''),
    items: get<any[]>(source, 'items', 'Items', []).map(normalizeTransitionChecklistItem),
    conditionReport: reportSource ? {
      id: id(reportSource.id ?? reportSource.Id),
      checklistType: get(reportSource, 'checklistType', 'ChecklistType', 44),
      title: get(reportSource, 'title', 'Title', 'Condition report'),
      isCompleted: get(reportSource, 'isCompleted', 'IsCompleted', false),
      items: get<any[]>(reportSource, 'items', 'Items', []),
    } : null,
    completedAt: get<string | null>(source, 'completedAt', 'CompletedAt', null),
  };
};

const reportComplete = (checklist: LeaseTransitionChecklist) => Boolean(checklist.conditionReport?.isCompleted);

export const isTransitionItemDone = (checklist: LeaseTransitionChecklist, item: LeaseTransitionChecklistItem) =>
  item.key === 'condition-report'
    ? reportComplete(checklist)
    : String(item.status).toLowerCase() === 'done' || String(item.status).toLowerCase() === 'notapplicable';

export const getTransitionChecklistProgress = (checklist: LeaseTransitionChecklist) => {
  const applicable = checklist.items.filter((item) => String(item.status).toLowerCase() !== 'notapplicable');
  const total = applicable.length;
  const done = applicable.filter((item) => isTransitionItemDone(checklist, item)).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0, complete: total > 0 && done === total };
};

export const conditionReportAction = (checklist: LeaseTransitionChecklist) => {
  const reportId = checklist.conditionReport?.id;
  if (reportId == null) return { kind: 'start' as const, label: 'Start report', reportId: null };
  return checklist.conditionReport?.isCompleted
    ? { kind: 'view' as const, label: 'View report', reportId: String(reportId) }
    : { kind: 'continue' as const, label: 'Continue report', reportId: String(reportId) };
};
