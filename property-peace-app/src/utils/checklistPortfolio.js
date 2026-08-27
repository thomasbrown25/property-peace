export function buildChecklistWorkspacePath(checklist) {
  const basePath = `/landlord/checklists/property/${checklist.propertyId}`;
  return checklist.unitId ? `${basePath}/unit/${checklist.unitId}/checklist/${checklist.id}` : `${basePath}/checklist/${checklist.id}`;
}

export function getChecklistProgress(checklist) {
  const items = checklist?.items || [];
  const completed = items.filter((item) => item.isChecked).length;
  const total = items.length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
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
      (filters.status === 'completed' && checklist.isCompleted) ||
      (filters.status === 'in-progress' && !checklist.isCompleted);

    return (!query || searchable.includes(query)) && matchesType && matchesStatus;
  });
}
