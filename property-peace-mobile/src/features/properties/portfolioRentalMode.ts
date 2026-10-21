import type { Property, Unit } from '../../api/propertyAPI';
import type { PropertyRentalMode } from './rentalMode';

const modeOf = (unit: Unit) =>
  String(unit.rentalMode ?? unit.RentalMode ?? 'LongTerm').toLowerCase() === 'shortterm' ? 'ShortTerm' : 'LongTerm';

/** Only a complete inventory may classify a portfolio as short-term-only. */
export const portfolioRentalMode = (groups: Unit[][]): PropertyRentalMode => {
  const units = groups.flat();
  if (!units.length) return 'Empty';
  const hasShort = units.some(unit => modeOf(unit) === 'ShortTerm');
  const hasLong = units.some(unit => modeOf(unit) === 'LongTerm');
  return hasShort ? (hasLong ? 'Mixed' : 'ShortTerm') : 'LongTerm';
};

export async function loadPortfolioRentalMode(
  authorizedProperties: Property[],
  loadUnits: (id: string | number) => Promise<Unit[]>,
): Promise<PropertyRentalMode | null> {
  const ids = authorizedProperties.map(property => property.id ?? property.Id);
  if (ids.some(id => id == null || id === '')) return null;
  try {
    const groups = await Promise.all(ids.map(id => loadUnits(id)));
    if (groups.some(group => !Array.isArray(group))) return null;
    return portfolioRentalMode(groups);
  } catch {
    return null;
  }
}
