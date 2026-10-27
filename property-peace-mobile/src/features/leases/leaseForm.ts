import type { Lease } from '../../api/leaseAPI';

export type LeaseForm = {
  id?: number; propertyId: number; unitId: number; name: string; startDate: string; endDate: string;
  rentAmount: string; depositAmount: string; rentFrequency: string; rentDueDay: string;
  isDraft: boolean; isActive: boolean; leaseLength?: number;
  overdueAmount: string; petDepositAmount: string; proratedRentDue?: boolean; isProratedRent?: boolean;
  proratedRentAmount: string; prorationMethod: string;
  autoRenewLease?: boolean; autoRenewLeaseLength: string; autoRenewRentIncrement?: boolean;
  autoRenewRentIncrementType: string; autoRenewRentIncrementValue: string; createChecklistOnStartDate?: boolean;
  rentIncreaseType: string; rentIncreaseValue: string; rentIncreaseInterval: string;
  petsAllowed?: boolean; smokingAllowed: string; includeEarlyTerminationClause?: boolean;
  earlyTerminationClauseText: string; additionalTerms: string;
  dirtyFields: string[];
  fees: LeaseRow[]; leaseDeposits: LeaseRow[]; leaseLandlords: LeaseRow[]; leaseCoSigners: LeaseRow[];
  leaseAdditionalSigners: LeaseRow[]; leaseOccupants: LeaseRow[]; pets: LeaseRow[];
  utilityServiceResponsibilities: LeaseRow[]; maintenanceResponsibilities: LeaseRow[]; leaseKeys: LeaseRow[];
  parking: LeaseRow | null;
  rentCollectionByPlatform?: boolean; rentCollectionOther?: boolean; rentCollectionOtherOptions: string; rentCollectionOtherSpecify: string;
  addTenantsLater?: boolean; tenantMailingAddressDiffers?: boolean;
  tenantMailingStreetAddress: string; tenantMailingUnit: string; tenantMailingCity: string; tenantMailingState: string; tenantMailingZipCode: string;
  hasSharedUtilities?: boolean; sharedUtilitiesDisclosure: string; maintenanceNotificationMethods: string;
  builtBefore1978?: boolean; awareOfLeadPaint?: boolean; leadPaintExplanation: string; hasLeadPaintRecords?: boolean; leadPaintRecordsExplanation: string;
  original?: Lease;
  openedOriginal?: Lease;
};
export type LeaseRow = Record<string, string | boolean | undefined>;
// Only fields in the backend DTOs; never pass GET navigation objects back to POST.
export const rowFields = {
  fees: { text: ['name', 'dueDate', 'lateFeeType', 'feeType', 'limitType', 'limitAmountType'], money: ['amount', 'percentValue', 'limitAmount'], int: ['appliedAfterDays', 'startingAfterDays', 'limitDays'], bool: ['isLateFee'] },
  leaseDeposits: { text: ['name', 'dueDate'], money: ['amount'], int: ['sortOrder'], bool: [] },
  leaseLandlords: { text: ['entityType', 'firstName', 'lastName', 'companyName', 'email', 'phone', 'streetAddress', 'unit', 'city', 'state', 'zipCode'], money: [], int: ['sortOrder'], bool: [] },
  leaseCoSigners: { text: ['firstName', 'lastName', 'email'], money: [], int: ['sortOrder'], bool: [] },
  leaseAdditionalSigners: { text: ['firstName', 'lastName', 'email'], money: [], int: ['sortOrder'], bool: [] },
  leaseOccupants: { text: ['firstName', 'lastName', 'email'], money: [], int: ['sortOrder'], bool: [] },
  pets: { text: ['type', 'breed'], money: ['weight'], int: ['age'], bool: [] },
  parking: { text: ['parkingTypes', 'customRules'], money: [], int: [], bool: ['includeParkingRules'] },
  utilityServiceResponsibilities: { text: ['name', 'responsibility'], money: [], int: [], bool: ['isRequired'] },
  maintenanceResponsibilities: { text: ['name', 'description', 'responsibility'], money: [], int: [], bool: [] },
  leaseKeys: { text: ['keyType'], money: [], int: ['copies'], bool: [] },
} as const;
export type RowField = keyof typeof rowFields;
const row = (value: Lease, spec: typeof rowFields[RowField]): LeaseRow => {
  const result: LeaseRow = {};
  for (const key of ['id', 'leaseId', 'organizationId', ...spec.text, ...spec.money, ...spec.int, ...spec.bool]) {
    const item = readLeaseField(value, key);
    if (item !== undefined && item !== null) result[key] = typeof item === 'boolean' ? item : String(item);
  }
  return result;
};
const rows = (lease: Lease, key: RowField): LeaseRow[] => Array.isArray(readLeaseField(lease, key)) ? readLeaseField(lease, key).map((item: Lease) => row(item, rowFields[key])) : [];
const scalarText = ['rentCollectionOtherOptions', 'rentCollectionOtherSpecify', 'tenantMailingStreetAddress', 'tenantMailingUnit', 'tenantMailingCity', 'tenantMailingState', 'tenantMailingZipCode', 'sharedUtilitiesDisclosure', 'maintenanceNotificationMethods', 'leadPaintExplanation', 'leadPaintRecordsExplanation'] as const;
const scalarBool = ['rentCollectionByPlatform', 'rentCollectionOther', 'addTenantsLater', 'tenantMailingAddressDiffers', 'hasSharedUtilities', 'builtBefore1978', 'awareOfLeadPaint', 'hasLeadPaintRecords'] as const;
export const readLeaseField = (value: Lease, key: string) => value?.[key] ?? value?.[key[0].toUpperCase() + key.slice(1)];
const hasField = (value: Lease, key: string) => value && (value[key] !== undefined || value[key[0].toUpperCase() + key.slice(1)] !== undefined);
const text = (value: Lease, key: string) => String(readLeaseField(value, key) ?? '');
const day = (value: Lease, key: string) => text(value, key).slice(0, 10);
export const isSignedLease = (lease: Lease) => {
  const agreement = readLeaseField(lease, 'leaseAgreement') ?? {};
  return Boolean(['landlordSignedAt', 'signatureCompletedAt', 'docuSignEnvelopeId'].some(key => readLeaseField(agreement, key)) || String(readLeaseField(agreement, 'signatureStatus') ?? '').toLowerCase() === 'completed');
};
export const emptyLease = (): LeaseForm => ({ propertyId: 0, unitId: 0, name: '', startDate: '', endDate: '', rentAmount: '', depositAmount: '', rentFrequency: 'monthly', rentDueDay: '1', isDraft: true, isActive: false, overdueAmount: '', petDepositAmount: '', proratedRentDue: false, isProratedRent: false, proratedRentAmount: '', prorationMethod: 'calculated', autoRenewLease: false, autoRenewLeaseLength: '12', autoRenewRentIncrement: false, autoRenewRentIncrementType: 'percentage', autoRenewRentIncrementValue: '', createChecklistOnStartDate: true, rentIncreaseType: '', rentIncreaseValue: '', rentIncreaseInterval: '', petsAllowed: undefined, smokingAllowed: '', includeEarlyTerminationClause: false, earlyTerminationClauseText: '', additionalTerms: '', dirtyFields: [], fees: [], leaseDeposits: [], leaseLandlords: [], leaseCoSigners: [], leaseAdditionalSigners: [], leaseOccupants: [], pets: [], parking: null, utilityServiceResponsibilities: [], maintenanceResponsibilities: [], leaseKeys: [], rentCollectionOtherOptions: '', rentCollectionOtherSpecify: '', tenantMailingStreetAddress: '', tenantMailingUnit: '', tenantMailingCity: '', tenantMailingState: '', tenantMailingZipCode: '', sharedUtilitiesDisclosure: '', maintenanceNotificationMethods: '', leadPaintExplanation: '', leadPaintRecordsExplanation: '' });
export const hydrateLease = (lease: Lease): LeaseForm => ({
  ...emptyLease(), original: lease, openedOriginal: lease,
  id: Number(readLeaseField(lease, 'id')), propertyId: Number(readLeaseField(lease, 'propertyId')), unitId: Number(readLeaseField(lease, 'unitId')),
  name: text(lease, 'name'), startDate: day(lease, 'startDate'), endDate: day(lease, 'endDate'),
  rentAmount: text(lease, 'rentAmount'), depositAmount: text(lease, 'depositAmount'),
  rentFrequency: String(readLeaseField(lease, 'rentFrequency') ?? 'monthly').toLowerCase(), rentDueDay: String(readLeaseField(lease, 'rentDueDay') ?? '1'),
  leaseLength: readLeaseField(lease, 'leaseLength') == null ? undefined : Number(readLeaseField(lease, 'leaseLength')),
  isDraft: readLeaseField(lease, 'isDrafted') === true || readLeaseField(readLeaseField(lease, 'leaseAgreement') ?? {}, 'isDrafted') === true,
  isActive: readLeaseField(lease, 'isActive') === true,
  overdueAmount: text(lease, 'overdueAmount'), petDepositAmount: text(lease, 'petDepositAmount'),
  proratedRentDue: readLeaseField(lease, 'proratedRentDue'), isProratedRent: readLeaseField(lease, 'isProratedRent'),
  proratedRentAmount: text(lease, 'proratedRentAmount'), prorationMethod: text(lease, 'prorationMethod'),
  autoRenewLease: readLeaseField(lease, 'autoRenewLease'), autoRenewLeaseLength: text(lease, 'autoRenewLeaseLength'),
  autoRenewRentIncrement: readLeaseField(lease, 'autoRenewRentIncrement'), autoRenewRentIncrementType: text(lease, 'autoRenewRentIncrementType'), autoRenewRentIncrementValue: text(lease, 'autoRenewRentIncrementValue'),
  createChecklistOnStartDate: readLeaseField(lease, 'createChecklistOnStartDate'),
  rentIncreaseType: text(lease, 'rentIncreaseType'), rentIncreaseValue: text(lease, 'rentIncreaseValue'), rentIncreaseInterval: text(lease, 'rentIncreaseInterval'),
  petsAllowed: readLeaseField(lease, 'petsAllowed'), smokingAllowed: text(lease, 'smokingAllowed'),
  includeEarlyTerminationClause: readLeaseField(lease, 'includeEarlyTerminationClause'), earlyTerminationClauseText: text(lease, 'earlyTerminationClauseText'), additionalTerms: text(lease, 'additionalTerms'),
  ...Object.fromEntries(scalarText.map(key => [key, text(lease, key)])),
  ...Object.fromEntries(scalarBool.map(key => [key, readLeaseField(lease, key)])),
  ...Object.fromEntries((Object.keys(rowFields) as RowField[]).filter(key => key !== 'parking').map(key => [key, rows(lease, key)])),
  parking: readLeaseField(lease, 'parking') ? row(readLeaseField(lease, 'parking'), rowFields.parking) : null,
});
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validMoney = (value: string) => /^\d+(?:\.\d{1,2})?$/.test(value.trim()) && Number.isFinite(Number(value));
const integer = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
// LeaseLength is in calendar months; the day before an anniversary is a whole-month term.
const termMonths = (start: string, end: string) => {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  return Math.max(1, (endYear - startYear) * 12 + endMonth - startMonth + (endDay >= startDay ? 1 : 0));
};
export function validateLease(form: Partial<LeaseForm>, draft: boolean): string | null {
  if (!Number.isSafeInteger(Number(form.propertyId)) || Number(form.propertyId) <= 0 || !Number.isSafeInteger(Number(form.unitId)) || Number(form.unitId) <= 0) return 'Choose a property and unit.';
  if (form.startDate && !validDate(form.startDate)) return 'Enter a valid start date (YYYY-MM-DD).';
  if (form.endDate && !validDate(form.endDate)) return 'Enter a valid end date (YYYY-MM-DD).';
  if (form.startDate && form.endDate && form.endDate <= form.startDate) return 'End date must be after start date.';
  for (const key of ['rentAmount', 'depositAmount', 'overdueAmount', 'petDepositAmount', 'proratedRentAmount', 'autoRenewRentIncrementValue', 'rentIncreaseValue'] as const) {
    if (form[key] && !validMoney(form[key])) return `Enter a valid non-negative ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}.`;
  }
  if (form.rentDueDay && (!integer(form.rentDueDay) || Number(form.rentDueDay) < 1 || Number(form.rentDueDay) > 31)) return 'Rent due day must be 1–31.';
  if (form.rentFrequency && !['monthly', 'quarterly', 'yearly'].includes(form.rentFrequency)) return 'Choose a rent frequency.';
  if (form.autoRenewLeaseLength && (!integer(form.autoRenewLeaseLength) && form.autoRenewLeaseLength !== '-1' || Number(form.autoRenewLeaseLength) === 0)) return 'Renewal length must be positive months or -1 (month-to-month).';
  if (form.autoRenewLease && !form.autoRenewLeaseLength) return 'Enter a renewal length.';
  if (form.proratedRentDue && (!form.proratedRentAmount || Number(form.proratedRentAmount) <= 0)) return 'Enter a positive prorated rent amount.';
  if (form.autoRenewLease && form.autoRenewRentIncrement && !form.autoRenewRentIncrementValue) return 'Enter a renewal increase value.';
  if (form.rentIncreaseType && (!form.rentIncreaseValue || !form.rentIncreaseInterval)) return 'Enter a rent increase value and interval.';
  if (form.rentIncreaseInterval && (!integer(form.rentIncreaseInterval) || Number(form.rentIncreaseInterval) < 1)) return 'Rent increase interval must be positive months.';
  if (form.rentIncreaseType && !['percentage', 'amount'].includes(form.rentIncreaseType)) return 'Choose a rent increase type.';
  if (form.autoRenewRentIncrementType && !['percentage', 'amount'].includes(form.autoRenewRentIncrementType)) return 'Choose a renewal increase type.';
  if (form.rentIncreaseType === 'percentage' && Number(form.rentIncreaseValue) > 100 || form.autoRenewRentIncrementType === 'percentage' && Number(form.autoRenewRentIncrementValue) > 100) return 'Percentage increases cannot exceed 100.';
  if (form.smokingAllowed && !['yes', 'no', 'outsideOnly'].includes(form.smokingAllowed)) return 'Choose a smoking policy.';
  for (const key of ['rentCollectionOtherOptions', 'maintenanceNotificationMethods'] as const) if (form.dirtyFields?.includes(key) && form[key]) {
    try {
      const parsed = JSON.parse(form[key]);
      if (key === 'rentCollectionOtherOptions' ? !parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some(value => typeof value !== 'boolean') : !Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) return `Choose valid ${key}.`;
    } catch { return `Choose valid ${key}.`; }
  }
  if (form.dirtyFields?.includes('parking') && form.parking?.parkingTypes) {
    try { const types = JSON.parse(String(form.parking.parkingTypes)); if (!Array.isArray(types) || types.some(value => typeof value !== 'string')) return 'Choose valid parking types.'; }
    catch { return 'Choose valid parking types.'; }
  }
  for (const key of Object.keys(rowFields) as RowField[]) {
    const spec = rowFields[key];
    const entries = key === 'parking' ? form.parking ? [form.parking] : [] : (form[key] as LeaseRow[] | undefined) ?? [];
    for (const entry of entries) {
      for (const field of spec.money) if (entry[field] && !validMoney(String(entry[field]))) return `Enter a valid ${field} in ${key}.`;
      for (const field of spec.int) if (entry[field] && !integer(String(entry[field]))) return `Enter a whole number for ${field} in ${key}.`;
      if (key === 'leaseKeys' && entry.copies !== undefined && Number(entry.copies) < 1) return 'Key copies must be positive.';
      if ((key === 'fees' || key === 'leaseDeposits') && entry.dueDate && !validDate(String(entry.dueDate).slice(0, 10))) return `Enter a valid due date in ${key}.`;
      if ((key === 'fees' || key === 'leaseDeposits') && (!entry.name?.toString().trim() || !entry.amount || !entry.dueDate)) return `Enter name, amount and due date in ${key}.`;
      if (key === 'pets' && !entry.type?.toString().trim()) return 'Enter a pet type.';
    }
  }
  if (!draft && (!form.startDate || !form.endDate || !form.rentAmount || !form.rentDueDay || !form.rentFrequency)) return 'Enter dates, rent amount, frequency and due day to create a lease.';
  return null;
}
const nullableNumber = (value: string) => value === '' ? null : Number(value);
const serializeRow = (item: LeaseRow, spec: typeof rowFields[RowField]) => {
  const result: Record<string, unknown> = {};
  for (const key of ['id', 'leaseId', 'organizationId', ...spec.text, ...spec.money, ...spec.int, ...spec.bool]) {
    if (item[key] === undefined) continue;
    result[key] = [...spec.money, ...spec.int, 'id', 'leaseId', 'organizationId'].includes(key) ? nullableNumber(String(item[key])) : item[key];
  }
  return result;
};
// Only UpdateLeaseDto fields are forwarded. Never spread the GET projection (navigation,
// agreement/signatures, tenants, etc.). Missing fields remain absent, not empty arrays.
const preservedFields = ['customDateSelected', 'isScreeningComplete', 'organizationId', 'operatingAccountId', 'markPastPaymentsAsPaid', 'fees', 'leaseDeposits', 'rentCollectionByPlatform', 'rentCollectionOther', 'rentCollectionOtherOptions', 'rentCollectionOtherSpecify', 'addTenantsLater', 'tenantMailingAddressDiffers', 'tenantMailingStreetAddress', 'tenantMailingUnit', 'tenantMailingCity', 'tenantMailingState', 'tenantMailingZipCode', 'leaseLandlords', 'leaseCoSigners', 'leaseAdditionalSigners', 'leaseOccupants', 'pets', 'parking', 'hasSharedUtilities', 'sharedUtilitiesDisclosure', 'maintenanceNotificationMethods', 'utilityServiceResponsibilities', 'maintenanceResponsibilities', 'leaseKeys', 'builtBefore1978', 'awareOfLeadPaint', 'leadPaintExplanation', 'hasLeadPaintRecords', 'leadPaintRecordsExplanation'] as const;
export function leasePayload(form: LeaseForm, draft: boolean) {
  const original = form.original;
  const preserved: Record<string, unknown> = {};
  if (original) for (const key of preservedFields) if (hasField(original, key)) preserved[key] = readLeaseField(original, key);
  for (const key of scalarText) if (form.dirtyFields?.includes(key)) preserved[key] = form[key];
  for (const key of scalarBool) if (form.dirtyFields?.includes(key)) preserved[key] = form[key];
  for (const key of Object.keys(rowFields) as RowField[]) {
    if (!form.dirtyFields?.includes(key)) continue;
    const value = form[key];
    const initial = form.openedOriginal ?? original;
    const oldRows = initial && key !== 'parking' ? rows(initial, key) : [];
    const latestRows = original && key !== 'parking' ? rows(original, key) : [];
    const merge = (item: LeaseRow) => {
      const old = oldRows.find(entry => entry.id && entry.id === item.id);
      const latest = latestRows.find(entry => entry.id && entry.id === item.id);
      // Keep fresh web edits to different columns of the same existing row.
      const combined: LeaseRow = latest && old ? { ...latest, ...Object.fromEntries(Object.entries(item).filter(([field, entered]) => entered !== old[field])) } : item;
      return serializeRow(combined, rowFields[key]);
    };
    const oldParking = initial && readLeaseField(initial, 'parking');
    const latestParking = original && readLeaseField(original, 'parking');
    const mergedParking = value && oldParking && latestParking ? { ...row(latestParking, rowFields.parking), ...Object.fromEntries(Object.entries(value as LeaseRow).filter(([field, entered]) => entered !== row(oldParking, rowFields.parking)[field])) } : value;
    preserved[key] = key === 'parking' ? mergedParking ? serializeRow(mergedParking as LeaseRow, rowFields.parking) : null : (value as LeaseRow[]).map(merge);
  }
  const sameDates = original && day(original, 'startDate') === form.startDate && day(original, 'endDate') === form.endDate;
  const optionalBool = (key: keyof LeaseForm) => form[key] === undefined ? {} : { [key]: form[key] };
  const optionalText = (key: keyof LeaseForm, convert: (value: string) => unknown) => {
    const value = form[key] as string;
    // An absent field in a partial GET is not an instruction to clear it on update.
    if (original && !hasField(original, key) && !value) return {};
    return { [key]: convert(value) };
  };
  return {
    ...preserved,
    ...(form.id ? { id: form.id } : {}), propertyId: Number(form.propertyId), unitId: Number(form.unitId),
    name: form.name.trim() || null, startDate: form.startDate || null, endDate: form.endDate || null,
    rentAmount: nullableNumber(form.rentAmount), depositAmount: nullableNumber(form.depositAmount),
    leaseLength: sameDates && form.leaseLength !== undefined ? form.leaseLength : form.leaseLength === -1 ? -1 : form.startDate && form.endDate ? termMonths(form.startDate, form.endDate) : null,
    rentFrequency: form.rentFrequency ? form.rentFrequency[0].toUpperCase() + form.rentFrequency.slice(1) : null,
    rentDueDay: nullableNumber(form.rentDueDay), isDrafted: draft, isActive: form.id && !form.isDraft ? form.isActive : !draft,
    ...optionalText('overdueAmount', nullableNumber), ...optionalText('petDepositAmount', nullableNumber),
    ...optionalBool('proratedRentDue'), ...optionalBool('isProratedRent'), ...optionalText('proratedRentAmount', nullableNumber), ...optionalText('prorationMethod', value => value || null),
    ...optionalBool('autoRenewLease'), ...optionalText('autoRenewLeaseLength', nullableNumber),
    ...optionalBool('autoRenewRentIncrement'), ...optionalText('autoRenewRentIncrementType', value => value || null),
    ...optionalText('autoRenewRentIncrementValue', nullableNumber), ...optionalBool('createChecklistOnStartDate'),
    ...optionalText('rentIncreaseType', value => value || null), ...optionalText('rentIncreaseValue', nullableNumber), ...optionalText('rentIncreaseInterval', nullableNumber),
    ...optionalBool('petsAllowed'), ...optionalText('smokingAllowed', value => value || null),
    ...optionalBool('includeEarlyTerminationClause'), ...optionalText('earlyTerminationClauseText', value => value || null), ...optionalText('additionalTerms', value => value || null),
  };
}
