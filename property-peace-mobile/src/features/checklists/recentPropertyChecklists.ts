import type { Checklist } from './checklistTypes';

// Prefer the last activity, then inspection date, then creation; undated records follow dated ones.
export const checklistDate = (item: Checklist): string | null =>
  [item.updatedAt, item.inspectionDate, item.completedAt, item.createdAt]
    .find((value) => value && Number.isFinite(Date.parse(value))) || null;

export const recentPropertyChecklists = (items: readonly Checklist[], propertyId: string): Checklist[] =>
  items.filter(item => item.propertyId != null && String(item.propertyId) === String(propertyId))
    .sort((a, b) => (checklistDate(b) ? Date.parse(checklistDate(b)!) : 0) - (checklistDate(a) ? Date.parse(checklistDate(a)!) : 0));

export const checklistSummary = (item: Checklist): string => {
  const status = item.isCompleted || item.completedAt ? 'Completed' : 'In progress';
  const date = checklistDate(item);
  return [status, item.unitName, date ? new Date(date).toLocaleDateString() : null].filter(Boolean).join(' · ');
};
