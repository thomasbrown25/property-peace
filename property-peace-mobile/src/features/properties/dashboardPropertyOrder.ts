import type { Property } from '../../api/propertyAPI';
import type { PropertyCollection } from '../rentCollection/propertyCollection';

// The property-list API derives occupied/overdue from a current, started, active lease.
// Do not use property-level IsOccupied here: a multi-unit property can have a lease
// on just one unit, and scheduled or draft leases should not move it to the top.
export function hasActiveLease(property: Property): boolean {
  const units = property.units ?? property.Units;
  return Array.isArray(units) && units.some(unit =>
    ['occupied', 'overdue'].includes(String(unit.status ?? unit.Status ?? '').toLowerCase()));
}

export function dashboardPropertiesWithActiveLeases(properties: Property[]): Property[] {
  return properties.filter(hasActiveLease);
}

export function dashboardPropertiesWithExpectedRent(properties: Property[], collections: Map<string, PropertyCollection> | null): Property[] {
  if (!collections) return [];
  return dashboardPropertiesWithActiveLeases(properties).filter(property =>
    (collections.get(String(property.id ?? property.Id ?? ''))?.expected ?? 0) > 0);
}

export function dashboardPropertiesWithActiveLeasesFirst(properties: Property[]): Property[] {
  const leased: Property[] = [];
  const others: Property[] = [];
  for (const property of properties) {
    (hasActiveLease(property) ? leased : others).push(property);
  }
  return [...leased, ...others];
}
