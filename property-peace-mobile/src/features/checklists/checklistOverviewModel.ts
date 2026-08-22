import type { Checklist, ChecklistCycle, ChecklistHome } from './checklistTypes';

type ChecklistOverviewSide = {
  checklistId: string;
  label: 'Move-in' | 'Move-out';
  title: string;
  done: number;
  total: number;
  percent: number;
  complete: boolean;
  date: string | null;
  tenantName: string;
};

const side = (checklist: Checklist | null, label: ChecklistOverviewSide['label']): ChecklistOverviewSide | null => {
  if (!checklist || checklist.id == null) return null;
  const total = checklist.items.length;
  const done = checklist.items.filter((item) => Boolean(item.condition)).length;
  const complete = total > 0 && done === total;
  return {
    checklistId: String(checklist.id),
    label,
    title: checklist.title || `${label} checklist`,
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
    complete,
    date: checklist.inspectionDate || checklist.completedAt || checklist.createdAt || null,
    tenantName: checklist.tenantName || '',
  };
};

export const buildChecklistOverviewCards = (cycles: ChecklistCycle[]) => cycles.map((cycle) => ({
  id: cycle.id,
  moveIn: side(cycle.moveIn, 'Move-in'),
  moveOut: side(cycle.moveOut, 'Move-out'),
}));

export const checklistHistoryScope = (home: ChecklistHome) => home.unitId
  ? { scope: 'unit' as const, id: home.unitId }
  : { scope: 'property' as const, id: home.propertyId };

export const isChecklistStarted = (checklist: Partial<Checklist>) =>
  Boolean(checklist.inspectionDate || checklist.isCompleted || checklist.items?.some((item) => Boolean(item.condition)));
