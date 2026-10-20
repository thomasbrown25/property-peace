import type { Property, Unit } from '../../api/propertyAPI';

const get = (item: Record<string, any>, key: string) => item[key] ?? item[key[0].toUpperCase() + key.slice(1)];
const text = (value: unknown) => value == null ? '' : String(value);
const numeric = (value: string) => value.trim() === '' ? 0 : Number(value);
const invalidNumber = (value: string) => value.trim() !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0);

export type PropertyForm = { name: string; address: string; city: string; state: string; zipCode: string; propertyType: string; yearBuilt: string };
export const emptyProperty = (): PropertyForm => ({ name: '', address: '', city: '', state: '', zipCode: '', propertyType: 'singleFamily', yearBuilt: '' });
export const prefillProperty = (property: Property): PropertyForm => ({
  name: text(get(property, 'name')), address: text(get(property, 'streetAddress') ?? get(property, 'address')),
  city: text(get(property, 'city')), state: text(get(property, 'state')), zipCode: text(get(property, 'zipCode')),
  propertyType: ['multiunit', '1'].includes(text(get(property, 'propertyType')).toLowerCase()) ? 'multiUnit' : 'singleFamily', yearBuilt: text(get(property, 'yearBuilt')),
});
const multiTypes = ['multiUnit', 'smallMultiFamily', 'apartmentBuilding', 'other'];
const singleTypes = ['singleFamily', 'townhouse', 'condominium'];
export const propertyErrors = (form: PropertyForm): string[] => {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push('Property name is required');
  if (form.name.trim().length > 255) errors.push('Property name must be 255 characters or less');
  for (const [value, label, max] of [[form.address, 'Street address', 300], [form.city, 'City', 100], [form.state, 'State', 50], [form.zipCode, 'ZIP code', 20]] as const) {
    if (!value.trim()) errors.push(`${label} is required`);
    if (value.trim().length > max) errors.push(`${label} is too long`);
  }
  if (![...multiTypes, ...singleTypes].includes(form.propertyType)) errors.push('Choose a property type');
  if (form.yearBuilt.trim() && (!/^\d{4}$/.test(form.yearBuilt.trim()) || Number(form.yearBuilt) > new Date().getFullYear())) errors.push('Enter a valid year built');
  return errors;
};
export const propertyPayload = (form: PropertyForm, original?: Property, initialUnitCount?: number) => ({
  ...(original ? {
    id: get(original, 'id'),
    description: get(original, 'description') ?? '',
    targetRent: get(original, 'targetRent') ?? 0,
    landlordId: get(original, 'landlordId'),
    ...(get(original, 'dateListed') != null ? { dateListed: get(original, 'dateListed') } : {}),
    ...(get(original, 'targetDeposit') != null ? { targetDeposit: get(original, 'targetDeposit') } : {}),
    ...(get(original, 'lotSize') != null ? { lotSize: get(original, 'lotSize') } : {}),
    ...(get(original, 'operatingAccountId') != null ? { operatingAccountId: get(original, 'operatingAccountId') } : {}),
    ...(get(original, 'primaryManagerId') != null ? { primaryManagerId: get(original, 'primaryManagerId') } : {}),
    ...(get(original, 'contactEmail') != null ? { contactEmail: get(original, 'contactEmail') } : {}),
    ...(get(original, 'contactPhone') != null ? { contactPhone: get(original, 'contactPhone') } : {}),
    ...(get(original, 'isActive') != null ? { isActive: get(original, 'isActive') } : {}),
    ...(get(original, 'mainImageUrl') != null ? { mainImageUrl: get(original, 'mainImageUrl') } : {}),
    ...(get(original, 'isOccupied') != null ? { isOccupied: get(original, 'isOccupied') } : {}),
    ...(get(original, 'unitCount') != null ? { unitCount: get(original, 'unitCount') } : {}),
    ...(get(original, 'organizationId') != null ? { organizationId: get(original, 'organizationId') } : {}),
    ...(get(original, 'clientId') != null ? { clientId: get(original, 'clientId') } : {}),
  } : {}),
  ...(!original && multiTypes.includes(form.propertyType) && initialUnitCount !== undefined ? { unitCount: initialUnitCount } : {}),
  name: form.name.trim(), streetAddress: form.address.trim(), city: form.city.trim(), state: form.state.trim(), zipCode: form.zipCode.trim(),
  propertyType: multiTypes.includes(form.propertyType) ? 'multiUnit' : 'singleFamily',
  yearBuilt: form.yearBuilt.trim() ? Number(form.yearBuilt) : null,
});

export type UnitForm = { name: string; bedrooms: string; baths: string; squareFeet: string; rentAmount: string; type: string; isOccupied: boolean };
export const emptyUnit = (name = ''): UnitForm => ({ name, bedrooms: '', baths: '', squareFeet: '', rentAmount: '', type: '', isOccupied: false });
export const locationErrors = (form: PropertyForm) => propertyErrors(form).filter(error => !/property type|year built/i.test(error));
export const buildingErrors = (form: PropertyForm) => propertyErrors(form).filter(error => /property type|year built/i.test(error));
export const bulkUnitCountError = (value: string) => !/^[1-9]\d*$/.test(value.trim()) || Number(value) > 50
  ? 'Enter a whole number of units from 1 to 50' : '';
export const bulkUnitDrafts = (value: string): UnitForm[] =>
  bulkUnitCountError(value) ? [] : Array.from({ length: Number(value.trim()) }, (_, i) => emptyUnit(`Unit ${i + 1}`));
export const prefillUnit = (unit: Unit): UnitForm => ({
  name: text(get(unit, 'name')), bedrooms: text(get(unit, 'bedrooms')), baths: text(get(unit, 'baths')),
  squareFeet: text(get(unit, 'squareFeet')), rentAmount: text(get(unit, 'rentAmount')),
  type: text(get(unit, 'type')), isOccupied: Boolean(get(unit, 'isOccupied')),
});
export const unitErrors = (form: UnitForm): string[] => {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push('Unit name is required');
  if (!form.bedrooms.trim() || invalidNumber(form.bedrooms)) errors.push('Enter valid bedrooms');
  if (!form.baths.trim() || invalidNumber(form.baths)) errors.push('Enter valid baths');
  if (invalidNumber(form.squareFeet) || (form.squareFeet.trim() && !Number.isInteger(Number(form.squareFeet)))) errors.push('Square feet must be a nonnegative whole number');
  if (invalidNumber(form.rentAmount)) errors.push('Enter valid rent');
  return errors;
};
export const unitPayload = (form: UnitForm, propertyId: string | number, original?: Unit) => ({
  id: original ? get(original, 'id') : 0, propertyId: Number(propertyId), name: form.name.trim(),
  bedrooms: form.bedrooms.trim(), baths: form.baths.trim(), squareFeet: numeric(form.squareFeet), rentAmount: numeric(form.rentAmount),
  type: form.type.trim(), isOccupied: form.isOccupied,
  amenities: original ? get(original, 'amenities') ?? [] : [], includedUtility: original ? get(original, 'includedUtility') ?? [] : [],
});
// The property service creates Unit 1 (single-family) or Unit 1..N (multi-unit)
// in the same transaction as the property. Never POST a new unit for these drafts.
const untouchedInitialUnit = (unit: UnitForm, index: number) =>
  [String(index + 1), `Unit ${index + 1}`].includes(unit.name.trim()) &&
  !unit.bedrooms.trim() && !unit.baths.trim() && !unit.squareFeet.trim() &&
  !unit.rentAmount.trim() && !unit.type.trim() && !unit.isOccupied;

export const createPropertyErrors = (form: PropertyForm, units: UnitForm[]): string[] => [
  ...(multiTypes.includes(form.propertyType) && !units.length ? ['Add at least one unit for a multi-unit property'] : []),
  ...(singleTypes.includes(form.propertyType) && units.length > 1 ? ['Single-family properties have only one unit'] : []),
  ...units.flatMap((unit, index) => {
    if (untouchedInitialUnit(unit, index)) return [];
    // Backend-created rows may be filled in later; optional fields still need valid numbers.
    return unitErrors(unit).filter(error =>
      (unit.bedrooms.trim() || error !== 'Enter valid bedrooms') &&
      (unit.baths.trim() || error !== 'Enter valid baths'))
      .map(error => `Unit ${index + 1}: ${error}`);
  }),
];

export const initialUnitUpdates = (drafts: UnitForm[], existing: Unit[], propertyId: string | number) => {
  const updates: ReturnType<typeof unitPayload>[] = [];
  const matched = new Set<string>();
  drafts.forEach((draft, index) => {
    // Property GET does not guarantee unit order; match the generated Unit N names.
    const row = existing.find(unit => text(get(unit, 'name')).trim().toLowerCase() === `unit ${index + 1}`)
      ?? existing.find(unit => text(get(unit, 'name')).trim() === draft.name.trim());
    const id = row && get(row, 'id');
    if (!id || matched.has(String(id))) throw new Error('Could not find the existing unit. Refresh the property before retrying; no new unit was added.');
    matched.add(String(id));
    if (untouchedInitialUnit(draft, index)) return;
    updates.push(unitPayload(draft, propertyId, row));
  });
  return updates;
};

// Bulk POST has no idempotency key. A lost response may mean the transaction committed;
// never replay it in this screen unless a fresh manual reload starts a new attempt.
export class BulkCreateUncertainError extends Error {
  constructor() {
    super('Could not confirm which units were added. Go back and reload the property and its units before trying again; do not retry this request.');
  }
}

const unitIdentity = (unit: Unit) => ({ id: text(get(unit, 'id')).trim(), name: text(get(unit, 'name')).trim().toLowerCase() });

export const bulkCreateWithReconciliation = async (
  propertyId: string | number,
  drafts: UnitForm[],
  loadUnits: (propertyId: string | number) => Promise<Unit[]>,
  postUnits: (propertyId: string | number, units: ReturnType<typeof unitPayload>[]) => Promise<Unit[]>,
): Promise<void> => {
  // Snapshot IDs AND names before posting, not from the screen's potentially stale property.
  const before = (await loadUnits(propertyId)).map(unitIdentity);
  const ids = new Set(before.map(unit => unit.id));
  if (before.some(unit => !unit.id || !unit.name) || ids.size !== before.length)
    throw new Error('Could not verify existing units. Go back and reload the property before adding units.');
  const names = drafts.map(unit => unit.name.trim().toLowerCase());
  if (names.some(name => !name || before.some(unit => unit.name === name)) || new Set(names).size !== names.length)
    throw new Error('A unit name already exists or is repeated. Go back and reload the property before adding units.');
  try {
    await postUnits(propertyId, drafts.map(unit => unitPayload(unit, propertyId)));
    return;
  } catch {
    try {
      const after = (await loadUnits(propertyId)).map(unitIdentity);
      const newRows = after.filter(unit => !ids.has(unit.id));
      // Only an exact, unambiguous set of newly created rows can be treated as success.
      // Missing rows (even zero) may still be an in-flight commit; never resend automatically.
      if (after.length === before.length + names.length &&
          after.every(unit => unit.id && unit.name) &&
          new Set(after.map(unit => unit.id)).size === after.length &&
          before.every(old => after.some(unit => unit.id === old.id && unit.name === old.name)) &&
          newRows.length === names.length &&
          names.every(name => newRows.filter(unit => unit.name === name).length === 1)) return;
    } catch { /* Reconciliation itself failed: request outcome is still unknown. */ }
    throw new BulkCreateUncertainError();
  }
};

export const nextUnitName = (units: Unit[]) => {
  const numbers = units.map(unit => /^(?:unit\s*)?(\d+)$/i.exec(text(get(unit, 'name')).trim())).filter(Boolean).map(match => Number(match![1]));
  return String(numbers.length ? Math.max(...numbers) + 1 : units.length + 1);
};
