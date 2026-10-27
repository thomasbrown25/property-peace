import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/features/leases/leaseForm.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { hydrateLease, validateLease, leasePayload } = exports;
const complete = { propertyId: 3, unitId: 9, name: ' North ', startDate: '2026-11-01', endDate: '2027-10-31', rentAmount: '1200', depositAmount: '0', rentFrequency: 'monthly', rentDueDay: '1' };
test('hydrates mixed-case lease data preserving zero, false and agreement draft status', () => {
  const form = hydrateLease({ Id: 8, PropertyId: 3, UnitId: 9, RentAmount: 0, DepositAmount: 0, RentDueDay: 1, RentFrequency: 'Monthly', StartDate: '2026-11-01T00:00:00', EndDate: '2027-10-31T00:00:00', IsActive: false, LeaseAgreement: { IsDrafted: true } });
  assert.equal(form.rentAmount, '0'); assert.equal(form.depositAmount, '0'); assert.equal(form.rentFrequency, 'monthly'); assert.equal(form.startDate, '2026-11-01'); assert.equal(form.isDraft, true); assert.equal(form.isActive, false);
});
test('rejects invalid calendar days, reverse terms, fractional due day and negative or nonnumeric money', () => {
  for (const change of [{ startDate: '2026-02-30' }, { endDate: '2026-10-31' }, { rentDueDay: '1.5' }, { rentAmount: '-1' }, { depositAmount: 'Infinity' }]) assert.ok(validateLease({ ...complete, ...change }, false));
  assert.equal(validateLease(complete, false), null);
});
test('draft permits incomplete terms but never invalid entered values', () => {
  assert.equal(validateLease({ propertyId: 3, unitId: 9, rentAmount: '', startDate: '' }, true), null);
  assert.ok(validateLease({ ...complete, rentAmount: 'oops' }, true));
});
test('create and edit payloads use UpdateLeaseDto contract and retain edit lifecycle', () => {
  const payload = leasePayload(complete, false);
  assert.equal(payload.rentAmount, 1200); assert.equal(payload.depositAmount, 0); assert.equal(payload.rentFrequency, 'Monthly'); assert.equal(payload.isDrafted, false); assert.equal(payload.isActive, true);
  const edited = leasePayload({ ...complete, id: 8, isActive: false, isDraft: true }, true);
  assert.equal(edited.id, 8); assert.equal(edited.isActive, false); assert.equal(edited.isDrafted, true);
});
