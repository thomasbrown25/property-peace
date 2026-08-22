type PropertyShape = {
  id?: unknown;
  Id?: unknown;
  name?: unknown;
  Name?: unknown;
  streetAddress?: unknown;
  StreetAddress?: unknown;
  propertyType?: unknown;
  PropertyType?: unknown;
};

type UnitShape = { id?: unknown; Id?: unknown; name?: unknown; Name?: unknown };

const text = (...values: unknown[]) => {
  const found = values.find((value) => typeof value === 'string' && value.trim());
  return typeof found === 'string' ? found.trim() : '';
};

const requiresUnit = (property: PropertyShape) => [
  'multiunit', 'smallmultifamily', 'apartmentbuilding', 'multifamily', 'other',
].includes(text(property.propertyType, property.PropertyType).toLowerCase());

export const buildChecklistHomeParams = (property: PropertyShape, unit?: UnitShape | null) => {
  const propertyId = property.id ?? property.Id;
  if (propertyId == null) throw new Error('Property ID is required');
  if (requiresUnit(property) && (unit?.id ?? unit?.Id) == null) throw new Error('Select a unit to continue');
  const propertyName = text(property.name, property.Name, property.streetAddress, property.StreetAddress)
    || `Property ${String(propertyId)}`;
  const propertyType = text(property.propertyType, property.PropertyType);
  const unitId = unit?.id ?? unit?.Id;
  const unitName = text(unit?.name, unit?.Name) || (unitId == null ? '' : `Unit ${String(unitId)}`);
  return {
    propertyId: String(propertyId),
    propertyName,
    ...(propertyType ? { propertyType } : {}),
    ...(unitId == null ? {} : { unitId: String(unitId), unitName }),
  };
};

export const findPreselectedProperty = <T extends { id?: unknown; Id?: unknown }>(
  properties: readonly T[],
  propertyId?: string,
): T | null => propertyId
  ? properties.find((property) => String(property.id ?? property.Id) === propertyId) ?? null
  : null;

export const buildPropertyChecklistEntry = (property: PropertyShape) => {
  const propertyId = property.id ?? property.Id;
  if (propertyId == null) throw new Error('Property ID is required');
  if (requiresUnit(property)) {
    return {
      screen: 'ChecklistPropertySearch' as const,
      params: { preselectedPropertyId: String(propertyId) },
    };
  }
  return { screen: 'PropertyChecklists' as const, params: buildChecklistHomeParams(property) };
};
