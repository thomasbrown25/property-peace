// Rental mode belongs to units, not the building type or the property record.
export const rentalMode = (unit) => unit?.rentalMode ?? unit?.RentalMode ?? 'longTerm';
export const modeLabel = (unit) => rentalMode(unit) === 'shortTerm' ? 'Short-term' : 'Long-term';
export const targetRentalMode = (unit) => rentalMode(unit) === 'shortTerm' ? 'longTerm' : 'shortTerm';
export const propertyModeLabel = (property) => {
  const modes = new Set((property?.units ?? property?.Units ?? []).map(rentalMode));
  if (modes.size > 1) return 'Mixed';
  if (modes.size === 0) return 'No units';
  return modes.has('shortTerm') ? 'Short-term' : 'Long-term';
};

// The API creates a placeholder for single-family properties. Do not POST another one.
export const initialUnitCount = (backendPropertyType, draftUnits = []) => backendPropertyType === 'singleFamily' ? 1 : draftUnits.length;
export const missingInitialUnits = (draftUnits, existingUnits) => {
  const names = new Set((existingUnits ?? []).map(u => (u.name ?? u.Name ?? '').trim().toLowerCase()));
  return draftUnits.filter(u => !names.has(u.name.trim().toLowerCase()));
};
