import { getRoomProgress, getRoomTone } from './checklistRoomProgress.mjs';

export function buildChecklistWorkspacePath(checklist) {
  const basePath = `/landlord/checklists/property/${checklist.propertyId}`;
  return checklist.unitId ? `${basePath}/unit/${checklist.unitId}/checklist/${checklist.id}` : `${basePath}/checklist/${checklist.id}`;
}

export function getChecklistProgress(checklist) {
  const { done, total, pct } = getRoomProgress(checklist?.items || []);
  return { completed: done, total, percent: pct };
}

export function getChecklistStatus(checklist) {
  const items = checklist?.items || [];
  const { done, total } = getRoomProgress(items);
  if (total === 0 || done < total) return { label: 'In progress', color: 'warning', completed: false };
  const tone = getRoomTone(items);
  if (tone === 'error') return { label: 'Complete, needs repairs', color: 'error', completed: true };
  if (tone === 'success') return { label: 'Complete, all good', color: 'success', completed: true };
  return { label: 'Complete, needs attention', color: 'warning', completed: true };
}

export function getChecklistTypeLabel(checklist) {
  const type = String(checklist?.checklistTypeName || checklist?.title || '').toLowerCase();
  if (Number(checklist?.checklistType) === 40 || type.includes('move-in') || type.includes('movein')) return 'Move-in checklist';
  if (Number(checklist?.checklistType) === 41 || type.includes('move-out') || type.includes('moveout')) return 'Move-out checklist';
  return 'Checklist';
}

export function sortChecklistPortfolio(checklists, key = 'created', direction = 'desc') {
  const dateValue = (value) => {
    const timestamp = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(timestamp) ? timestamp : null;
  };
  const sortValue = (checklist) => {
    switch (key) {
      case 'home': return [checklist.propertyName, checklist.unitName].filter(Boolean).join(' · ');
      case 'checklist': return getChecklistTypeLabel(checklist);
      case 'lease': return dateValue(checklist.leaseStartDate || checklist.leaseEndDate);
      case 'progress': return getChecklistProgress(checklist).percent;
      case 'inspection': return dateValue(getChecklistDateSummary(checklist).value);
      case 'status': return getChecklistStatus(checklist).label;
      default: return dateValue(checklist.createdAt);
    }
  };
  return [...checklists].sort((a, b) => {
    const left = sortValue(a);
    const right = sortValue(b);
    if (left === null || left === '') return right === null || right === '' ? 0 : 1;
    if (right === null || right === '') return -1;
    const comparison = typeof left === 'string'
      ? left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
      : left - right;
    if (comparison !== 0) return direction === 'asc' ? comparison : -comparison;
    const createdDiff = (dateValue(b.createdAt) || 0) - (dateValue(a.createdAt) || 0);
    return createdDiff || (Number(b.id) || 0) - (Number(a.id) || 0);
  });
}

export function getChecklistDateSummary(checklist) {
  if (checklist.isCompleted && checklist.completedAt) {
    return { value: checklist.completedAt, label: 'Completed date' };
  }
  return { value: checklist.inspectionDate, label: 'Inspection date' };
}

export function enrichChecklistsWithProperties(checklists, properties = []) {
  const propertyById = new Map(properties.map((property) => [String(property.id ?? property.Id), property]));

  return checklists.map((checklist) => {
    const property = propertyById.get(String(checklist.propertyId));
    if (!property) return checklist;

    const streetAddress = property.streetAddress ?? property.StreetAddress;
    const city = property.city ?? property.City;
    const state = property.state ?? property.State;
    return {
      ...checklist,
      propertyName: checklist.propertyName || property.name || property.Name || streetAddress,
      propertyAddress: [streetAddress, city, state].filter(Boolean).join(', ')
    };
  });
}

export function filterChecklistPortfolio(checklists, filters = {}) {
  const query = String(filters.search || '')
    .trim()
    .toLowerCase();
  return checklists.filter((checklist) => {
    const searchable = [
      checklist.propertyName,
      checklist.propertyAddress,
      checklist.unitName,
      checklist.tenantName,
      checklist.title,
      checklist.checklistTypeName
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const type = String(checklist.checklistTypeName || checklist.checklistType || '').toLowerCase();
    const isMoveIn = Number(checklist.checklistType) === 40 || type.includes('move-in') || type.includes('movein');
    const isMoveOut = Number(checklist.checklistType) === 41 || type.includes('move-out') || type.includes('moveout');
    const matchesType =
      !filters.type || filters.type === 'all' || (filters.type === 'move-in' && isMoveIn) || (filters.type === 'move-out' && isMoveOut);
    const matchesStatus =
      !filters.status ||
      filters.status === 'all' ||
      (filters.status === 'completed' && getChecklistStatus(checklist).completed) ||
      (filters.status === 'in-progress' && !getChecklistStatus(checklist).completed);

    return (!query || searchable.includes(query)) && matchesType && matchesStatus;
  });
}
