import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/features/tenants/tenantForm.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { formFromTenant, validateTenant, tenantPayload } = exports;
const plain = value => JSON.parse(JSON.stringify(value));
test('edit prefills casing variants and preserves archived status, account and associations', () => {
  const tenant = { Id: 31, Firstname: 'Ada', Lastname: 'Lovelace', Email: null, PhoneNumber: '123', PropertyId: 4, UnitId: 9, LeaseId: 10, UserId: 22, IsActive: false };
  const form = formFromTenant(tenant);
  assert.deepEqual(plain(form), { firstName: 'Ada', lastName: 'Lovelace', email: '', phoneNumber: '123', propertyId: 4, unitId: 9, leaseId: 10 });
  assert.equal(validateTenant(form, 'edit'), null);
  assert.deepEqual(plain(tenantPayload(form, tenant)), { id: 31, firstname: 'Ada', lastname: 'Lovelace', email: null, phoneNumber: '123', unitId: 9, leaseId: 10, isActive: false });
});
test('create requires email, rejects mismatched selection and builds linked payload', () => {
  const form = { firstName: ' A ', lastName: ' B ', email: ' a@b.com ', phoneNumber: '', propertyId: 4, unitId: 9, leaseId: 10 };
  assert.equal(validateTenant(form), null);
  assert.deepEqual(plain(tenantPayload(form)), { firstname: 'A', lastname: 'B', email: 'a@b.com', phoneNumber: null, unitId: 9, leaseId: 10, isActive: true });
  assert.match(validateTenant({ ...form, email: '' }), /email/i);
  assert.match(validateTenant({ ...form, unitId: null, leaseId: 10 }), /unit/i);
  assert.match(validateTenant({ ...form, propertyId: 4, unitId: null }), /unit/i);
});
test('edit rejects malformed email but permits clearing email and associations', () => {
  const form = formFromTenant({ id: 1, firstname: 'A', lastname: 'B', email: 'x@y.com', unitId: 8 });
  assert.match(validateTenant({ ...form, email: 'invalid' }, 'edit'), /email/i);
  assert.equal(validateTenant({ ...form, email: '', propertyId: null, unitId: null }, 'edit'), null);
  assert.equal(tenantPayload({ ...form, email: '', propertyId: null, unitId: null }, { id: 1, isActive: true }).unitId, null);
});
test('add and edit wire the same association picker and edit reloads persisted tenant', () => {
  const add = readFileSync(new URL('../src/screens/landlord/AddTenantScreen.tsx', import.meta.url), 'utf8');
  const edit = readFileSync(new URL('../src/screens/landlord/TenantDetailScreen.tsx', import.meta.url), 'utf8');
  const picker = readFileSync(new URL('../src/screens/landlord/TenantAssociationFields.tsx', import.meta.url), 'utf8');
  assert.match(add, /TenantAssociationFields form=\{form\}/);
  assert.match(add, /TenantAPI\.createTenant\(tenantPayload\(form\)\)/);
  assert.match(edit, /setForm\(formFromTenant\(tenant\)\)/);
  assert.match(edit, /TenantAssociationFields form=\{form\}/);
  assert.match(edit, /TenantAPI\.updateTenant\(\{ \.\.\.tenantPayload\(form, tenant\)/);
  assert.match(edit, /TenantAPI\.getTenant\(tenantId\)/);
  assert.match(picker, /PropertyAPI\.getUnits\(form\.propertyId\)/);
});
