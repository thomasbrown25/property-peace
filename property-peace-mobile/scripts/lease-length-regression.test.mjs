import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/features/leases/leaseForm.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Date });
const { emptyLease, hydrateLease, validateLease, leasePayload } = exports;

test('complete lease sends required leaseLength in months to backend; draft can omit it', () => {
  const complete = { ...emptyLease(), propertyId: 3, unitId: 9, startDate: '2026-11-01', endDate: '2027-10-31', rentAmount: '1000', isDraft: false };
  assert.equal(validateLease(complete, false), null);
  assert.equal(leasePayload(complete, false).leaseLength, 12);
  assert.equal(leasePayload({ ...complete, startDate: '2026-11-15', endDate: '2027-05-14' }, false).leaseLength, 6);
  assert.equal(leasePayload({ ...emptyLease(), propertyId: 3, unitId: 9 }, true).leaseLength, null);
});

test('editing a month-to-month lease retains its existing leaseLength sentinel', () => {
  const form = hydrateLease({ Id: 12, PropertyId: 3, UnitId: 9, LeaseLength: -1, StartDate: '2026-11-01', EndDate: '2026-12-01', RentAmount: 1000 });
  assert.equal(leasePayload(form, false).leaseLength, -1);
});
