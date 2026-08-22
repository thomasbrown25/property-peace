type PropertySearchShape = {
  name?: unknown;
  Name?: unknown;
  streetAddress?: unknown;
  StreetAddress?: unknown;
  address?: unknown;
  Address?: unknown;
  city?: unknown;
  City?: unknown;
  state?: unknown;
  State?: unknown;
  propertyType?: unknown;
  PropertyType?: unknown;
};

const text = (...values: unknown[]) => {
  const found = values.find((value) => typeof value === 'string' && value.trim());
  return typeof found === 'string' ? found.trim() : '';
};

export const getChecklistPropertyLabel = (property: PropertySearchShape & { id?: unknown; Id?: unknown }) =>
  text(property.name, property.Name, property.streetAddress, property.StreetAddress)
  || `Property ${String(property.id ?? property.Id ?? '')}`.trim();

export const getChecklistPropertyAddress = (property: PropertySearchShape) =>
  [
    text(property.streetAddress, property.StreetAddress, property.address, property.Address),
    text(property.city, property.City),
    text(property.state, property.State),
  ].filter(Boolean).join(', ');

export const isMultiUnitProperty = (property?: PropertySearchShape | null) => {
  const propertyType = text(property?.propertyType, property?.PropertyType).toLowerCase();
  return ['multiunit', 'smallmultifamily', 'apartmentbuilding', 'multifamily', 'other'].includes(propertyType);
};

export const filterChecklistProperties = <T extends PropertySearchShape>(properties: readonly T[], search: string): T[] => {
  const query = search.trim().toLowerCase();
  if (!query) return [...properties];
  return properties.filter((property) => [
    getChecklistPropertyLabel(property),
    getChecklistPropertyAddress(property),
  ].join(' ').toLowerCase().includes(query));
};
