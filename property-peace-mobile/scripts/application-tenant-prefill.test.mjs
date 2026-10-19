import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applicationInitial, applicationPayload, prefillApplicationTenant, tenantMatchesApplication } from '../src/features/rentals/applicationForm.ts';

const base = applicationInitial({ PropertyId: 4, UnitId: 8, FirstName: 'Manual', Email: 'manual@example.com', PhoneNumber: 'old', CurrentCity: 'Boston' });

test('tenant selection prefills only nonempty contact information and preserves manual fields', () => {
  const filled = prefillApplicationTenant(base, { id: 12, firstname: 'Ada', lastname: 'Lovelace', email: 'ada@example.com', phoneNumber: null });
  assert.equal(filled.firstName, 'Ada');
  assert.equal(filled.lastName, 'Lovelace');
  assert.equal(filled.email, 'ada@example.com');
  assert.equal(filled.phoneNumber, 'old');
  assert.equal(filled.currentCity, 'Boston');
  assert.equal(filled.propertyId, 4);
  assert.equal(filled.unitId, 8);
  assert.equal(prefillApplicationTenant(base, { firstName: 'Grace', lastName: 'Hopper' }).firstName, 'Grace');
  assert.equal(prefillApplicationTenant(base, { firstname: '  ' }).firstName, 'Manual');
});

test('tenant options match selected property and unit, with unrestricted selection before property choice', () => {
  const tenant = { propertyId: 4, unitId: 8 };
  assert.equal(tenantMatchesApplication(tenant, base), true);
  assert.equal(tenantMatchesApplication({ PropertyId: '4', UnitId: '9' }, base), false);
  assert.equal(tenantMatchesApplication({ propertyId: 9 }, base), false);
  assert.equal(tenantMatchesApplication(tenant, { ...base, unitId: null }), true);
  assert.equal(tenantMatchesApplication(tenant, { ...base, propertyId: null, unitId: null }), true);
});

test('create and edit DTOs do not support selected tenant association; prefill never sends a fabricated link', () => {
  const filled = prefillApplicationTenant(base, { id: 12, firstname: 'Ada', lastname: 'Lovelace', email: 'ada@example.com' });
  for (const editing of [false, true]) {
    const payload = applicationPayload(filled, editing);
    assert.equal(payload.firstName, 'Ada');
    assert.equal(payload.tenantId, undefined);
    assert.equal(payload.selectedTenantId, undefined);
    assert.equal(payload.convertedToTenantId, undefined);
  }
});

test('native create and edit form expose tenant selection with retry and explicit manual choice', () => {
  const source = readFileSync(new URL('../src/screens/landlord/ApplicationFormModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /TenantAPI\.getTenants\(\)/);
  assert.match(source, /prefillApplicationTenant\(/);
  assert.match(source, /Use manual entry/);
  assert.match(source, /Retry loading tenants/);
  assert.match(source, /item\?\.id/);
});
