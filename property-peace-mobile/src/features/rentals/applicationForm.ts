export const applicationTexts = ['firstName', 'lastName', 'email', 'phoneNumber', 'dateOfBirth', 'currentAddress', 'currentCity', 'currentState', 'currentZipCode', 'employerName', 'jobTitle', 'monthlyIncome', 'employmentMonths', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship', 'previousLandlordName', 'previousLandlordPhone', 'numberOfOccupants', 'petDetails', 'vehicleDetails', 'desiredMoveInDate', 'additionalNotes'] as const;
export type ApplicationText = typeof applicationTexts[number];
export type ApplicationForm = Record<ApplicationText, string> & { propertyId: number | null; unitId: number | null; hasPets: boolean; hasVehicles: boolean; status: number };
const get = (item: Record<string, any>, key: string) => item[key] ?? item[key[0].toUpperCase() + key.slice(1)];
export function applicationInitial(item: Record<string, any> = {}): ApplicationForm {
  const result = { propertyId: get(item, 'propertyId') ?? null, unitId: get(item, 'unitId') ?? null, hasPets: Boolean(get(item, 'hasPets')), hasVehicles: Boolean(get(item, 'hasVehicles')), status: Number(get(item, 'status') ?? 0) } as ApplicationForm;
  for (const key of applicationTexts) result[key] = key === 'dateOfBirth' || key === 'desiredMoveInDate' ? String(get(item, key) ?? '').slice(0, 10) : String(get(item, key) ?? '');
  return result;
}
// Create accepts applicant contact fields, not a TenantId. ConvertedToTenantId is
// reserved for approved conversions; selecting a tenant only copies contact details.
export function prefillApplicationTenant(form: ApplicationForm, tenant: Record<string, any>): ApplicationForm {
  const next = { ...form };
  const fields = {
    firstName: tenant.firstname ?? tenant.firstName ?? tenant.Firstname ?? tenant.FirstName,
    lastName: tenant.lastname ?? tenant.lastName ?? tenant.Lastname ?? tenant.LastName,
    email: tenant.email ?? tenant.Email,
    phoneNumber: tenant.phoneNumber ?? tenant.PhoneNumber,
  };
  for (const key of ['firstName', 'lastName', 'email', 'phoneNumber'] as const) {
    if (typeof fields[key] === 'string' && fields[key].trim()) next[key] = fields[key].trim();
  }
  return next;
}
export function tenantMatchesApplication(tenant: Record<string, any>, form: ApplicationForm): boolean {
  if (form.propertyId == null) return true;
  const propertyId = tenant.propertyId ?? tenant.PropertyId;
  const unitId = tenant.unitId ?? tenant.UnitId;
  return Number(propertyId) === form.propertyId && (form.unitId == null || Number(unitId) === form.unitId);
}
const dates = ['dateOfBirth', 'desiredMoveInDate'] as const;
const numbers = ['monthlyIncome', 'employmentMonths', 'numberOfOccupants'] as const;
function validDate(value: string) { const date = new Date(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }
export function applicationError(form: ApplicationForm, editing: boolean, requiresUnit = false, original?: ApplicationForm): string {
  if (!editing && (!form.propertyId || (requiresUnit && !form.unitId))) return 'Select a property and unit where required.';
  if (!form.firstName.trim() || !form.lastName.trim()) return 'Enter first and last name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email.';
  if (dates.some(key => form[key] && !validDate(form[key]))) return 'Enter dates as YYYY-MM-DD.';
  for (const key of numbers) {
    const value = form[key].trim();
    if (value && (!Number.isFinite(Number(value)) || Number(value) < (key === 'numberOfOccupants' ? 1 : 0) || (key !== 'monthlyIncome' && !Number.isInteger(Number(value))))) return `Enter a valid ${key}.`;
  }
  // Null is ignored by the update endpoint for nullable date/number fields.
  for (const key of [...numbers, ...dates]) {
    if (editing && original?.[key].trim() && !form[key].trim())
      return `Cannot clear ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} here; the server does not support removing this value. Enter a replacement instead.`;
  }
  return '';
}
export function applicationPayload(form: ApplicationForm, editing: boolean): Record<string, string | number | boolean | null> {
  const payload: Record<string, string | number | boolean | null> = {};
  if (!editing) Object.assign(payload, { propertyId: form.propertyId, unitId: form.unitId, status: form.status, isLandlordEntered: true });
  for (const key of applicationTexts) {
    const raw = form[key].trim();
    payload[key] = (numbers as readonly string[]).includes(key) ? (raw ? Number(raw) : null) : (dates as readonly string[]).includes(key) ? (raw ? `${raw}T00:00:00` : null) : editing ? raw : raw || null;
  }
  payload.firstName = form.firstName.trim(); payload.lastName = form.lastName.trim(); payload.email = form.email.trim();
  payload.hasPets = form.hasPets; payload.hasVehicles = form.hasVehicles;
  return payload;
}
