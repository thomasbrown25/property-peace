export type TenantForm = { firstName: string; lastName: string; email: string; phoneNumber: string; propertyId?: number | null; unitId?: number | null; leaseId?: number | null };
type TenantRecord = Record<string, any>;
const read = (tenant: TenantRecord, ...keys: string[]) => keys.map(key => tenant[key]).find(value => value !== undefined && value !== null);
const id = (value: unknown): number | null => {
  const numeric = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};
export const emptyTenantForm = (): TenantForm => ({ firstName: '', lastName: '', email: '', phoneNumber: '', propertyId: null, unitId: null, leaseId: null });
export function formFromTenant(tenant: TenantRecord): TenantForm {
  return {
    firstName: String(read(tenant, 'firstname', 'Firstname', 'firstName', 'FirstName') ?? ''),
    lastName: String(read(tenant, 'lastname', 'Lastname', 'lastName', 'LastName') ?? ''),
    email: String(read(tenant, 'email', 'Email') ?? ''),
    phoneNumber: String(read(tenant, 'phoneNumber', 'PhoneNumber') ?? ''),
    propertyId: id(read(tenant, 'propertyId', 'PropertyId')),
    unitId: id(read(tenant, 'unitId', 'UnitId')),
    leaseId: id(read(tenant, 'leaseId', 'LeaseId')),
  };
}
export function validateTenant(form: TenantForm, mode: 'create' | 'edit' = 'create'): string | null {
  if (!form.firstName.trim()) return 'First name is required.';
  if (!form.lastName.trim()) return 'Last name is required.';
  if ((mode === 'create' || form.email.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address.';
  if (mode === 'create' && !form.propertyId) return 'Select a property.';
  if (form.propertyId && !form.unitId) return 'Select a unit for the property.';
  if (form.leaseId && !form.unitId) return 'Select a unit before choosing a lease.';
  return null;
}
export function tenantPayload(form: TenantForm, original?: TenantRecord) {
  const originalId = original && id(read(original, 'id', 'Id'));
  return {
    ...(originalId ? { id: originalId } : {}),
    firstname: form.firstName.trim(), lastname: form.lastName.trim(),
    email: form.email.trim() || null, phoneNumber: form.phoneNumber.trim() || null,
    unitId: form.unitId ?? null, leaseId: form.leaseId ?? null,
    isActive: original ? read(original, 'isActive', 'IsActive') !== false : true,
  };
}
