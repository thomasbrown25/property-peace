export type PropertySearchFields = {
  name?: string;
  Name?: string;
  streetAddress?: string;
  StreetAddress?: string;
  address?: string;
  Address?: string;
  city?: string;
  City?: string;
  state?: string;
  State?: string;
};

export const filterPropertiesForList = <T extends PropertySearchFields>(
  properties: readonly T[],
  search: string,
): T[] => {
  const query = search.trim().toLowerCase();
  if (!query) return [...properties];

  return properties.filter((property) => [
    property.name,
    property.Name,
    property.streetAddress,
    property.StreetAddress,
    property.address,
    property.Address,
    property.city,
    property.City,
    property.state,
    property.State,
  ].filter(Boolean).join(' ').toLowerCase().includes(query));
};
