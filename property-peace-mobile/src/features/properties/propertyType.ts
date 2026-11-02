// Match the backend EPropertyType values, including numeric enum responses from older endpoints.
const propertyTypes = ['singleFamily', 'multiUnit', 'townhouse', 'condominium', 'smallMultiFamily', 'apartmentBuilding', 'other'] as const;
export const propertyTypeKey = (value: unknown): string => {
  const key = String(value ?? '').trim().replace(/[\s_-]/g, '').toLowerCase();
  if (/^[0-6]$/.test(key)) return propertyTypes[Number(key)];
  if (key === 'multifamily') return 'multiUnit';
  return propertyTypes.find(type => type.toLowerCase() === key) ?? String(value ?? '').trim();
};
export const isSingleUnitProperty = (value: unknown): boolean =>
  ['singleFamily', 'townhouse', 'condominium'].includes(propertyTypeKey(value));
export const isMultiUnitProperty = (value: unknown): boolean =>
  ['multiUnit', 'smallMultiFamily', 'apartmentBuilding', 'other'].includes(propertyTypeKey(value));
export const propertyTypeLabel = (value: unknown): string => ({
  singleFamily: 'Single-family', multiUnit: 'Multi-unit', townhouse: 'Townhouse',
  condominium: 'Condominium', smallMultiFamily: 'Small multi-family',
  apartmentBuilding: 'Apartment building', other: 'Other multi-unit',
} as Record<string, string>)[propertyTypeKey(value)] ?? String(value ?? '');
