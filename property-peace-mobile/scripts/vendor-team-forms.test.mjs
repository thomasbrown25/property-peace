import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyVendorForm, vendorCreatePayload, vendorFormError } from '../src/features/vendors/vendorForm.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('vendor create supports web fields and normalizes blanks without dropping tax or 1099', () => {
  const form = { ...emptyVendorForm, name: ' Alice ', businessName: ' Co ', address: ' 123 Main ', city: ' Boston ', state: ' MA ', zipCode: ' 02101 ', taxId: ' 12-3456789 ', licenseNumber: ' L1 ', requires1099: true, description: ' Services ', specialties: ' Plumbing ', alternatePhone: ' 555 ', email: ' A@B.COM ', notes: ' note ' };
  assert.equal(vendorFormError(form), '');
  assert.deepEqual(vendorCreatePayload(form), { ...form, name: 'Alice', businessName: 'Co', address: '123 Main', city: 'Boston', state: 'MA', zipCode: '02101', taxId: '12-3456789', licenseNumber: 'L1', description: 'Services', specialties: 'Plumbing', alternatePhone: '555', email: 'A@B.COM', notes: 'note' });
});

test('vendor validates required name, email, and API field limits', () => {
  assert.match(vendorFormError(emptyVendorForm), /name/i);
  assert.match(vendorFormError({ ...emptyVendorForm, name: 'A', email: 'bad' }), /email/i);
  assert.match(vendorFormError({ ...emptyVendorForm, name: 'A', taxId: 'x'.repeat(51) }), /length/i);
});

test('vendor screen exposes complete create form and detail preserves redacted tax ID', () => {
  const list = read('../src/screens/landlord/VendorsScreen.tsx');
  const detail = read('../src/screens/landlord/VendorDetailScreen.tsx');
  const api = read('../src/api/vendorAPI.ts');
  for (const key of ['address', 'city', 'state', 'zipCode', 'taxId', 'licenseNumber', 'requires1099', 'description', 'specialties', 'alternatePhone']) {
    assert.match(list, new RegExp(key));
    assert.match(api, new RegExp(key));
  }
  assert.match(list, /vendorCreatePayload\(form\)/);
  assert.match(detail, /patchVendor\(vendorId, changes\)/);
  assert.doesNotMatch(detail, /taxId|TaxId/);
});

test('team invites and role changes follow web permissions with scoped mutations', () => {
  const screen = read('../src/screens/landlord/TeamScreen.tsx');
  const api = read('../src/api/teamAPI.ts');
  assert.match(screen, /teamAPI\.invite\(current\.scope, address, role\)/);
  assert.match(screen, /teamAPI\.updateRole\(selected\.id, role\)/);
  assert.match(api, /canManageBilling: role === 'Owner'/);
  assert.match(api, /canManageMembers: role === 'Owner'/);
});
