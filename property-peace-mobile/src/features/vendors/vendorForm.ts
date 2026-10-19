// Creation accepts the full AddVendorDto. Tax ID is write-only in the vendor read API;
// it must never be loaded into or cleared by an edit form.
export const emptyVendorForm = {
  name: '', businessName: '', category: '', description: '', specialties: '',
  email: '', phone: '', alternatePhone: '', address: '', city: '', state: '',
  zipCode: '', taxId: '', licenseNumber: '', requires1099: false, notes: '',
};
export type VendorCreateForm = typeof emptyVendorForm;

const limits: Partial<Record<keyof VendorCreateForm, number>> = {
  name: 200, businessName: 200, category: 100, description: 1000,
  specialties: 500, email: 200, phone: 50, alternatePhone: 50,
  address: 500, city: 100, state: 50, zipCode: 20, taxId: 50,
  licenseNumber: 100, notes: 2000,
};

export function vendorFormError(form: VendorCreateForm): string {
  if (!form.name.trim()) return 'Enter a vendor name.';
  if (Object.entries(limits).some(([key, limit]) => form[key as keyof VendorCreateForm].toString().trim().length > limit))
    return 'One or more fields exceed the allowed length.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address.';
  return '';
}

export function vendorCreatePayload(form: VendorCreateForm): VendorCreateForm {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as VendorCreateForm;
}
