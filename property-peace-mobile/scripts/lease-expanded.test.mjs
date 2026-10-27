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
const { emptyLease, hydrateLease, leasePayload, validateLease } = exports;
const base = { Id: 4, PropertyId: 2, UnitId: 6, StartDate: '2026-11-01', EndDate: '2027-10-31', RentAmount: 1200, Fees: [{ Id: 7, LeaseId: 4, Name: 'Late', Amount: 30, DueDate: '2026-11-01', IsLateFee: true, FeeType: 'Flat' }], LeaseDeposits: [{ Id: 8, Name: 'Key', Amount: 50, DueDate: '2026-11-02', SortOrder: 3 }], LeaseKeys: [{ Id: 9, KeyType: 'Front', Copies: 2 }], Parking: { Id: 10, IncludeParkingRules: true, ParkingTypes: '["garage"]', CustomRules: 'Assigned' }, RentCollectionOtherOptions: '["cash"]', BuiltBefore1978: false, TenantMailingCity: 'Boston' };
const plain = value => JSON.parse(JSON.stringify(value));
test('hydrate expanded fields and rows, retain unedited fresh record and avoid GET-only fields', () => {
  const form = hydrateLease(base);
  assert.equal(form.builtBefore1978, false);
  assert.equal(form.fees[0].name, 'Late');
  assert.equal(form.parking.customRules, 'Assigned');
  assert.equal(form.rentCollectionOtherOptions, '["cash"]');
  const latest = { ...base, Fees: [{ ...base.Fees[0], Amount: 45 }], TenantMailingCity: 'Cambridge', LeaseAgreement: { SignatureStatus: 'Pending' } };
  const payload = leasePayload({ ...form, original: latest }, false);
  assert.deepEqual(plain(payload.fees), latest.Fees);
  assert.equal(payload.tenantMailingCity, 'Cambridge');
  assert.equal(payload.leaseAgreement, undefined);
});
test('edited DTO rows preserve ids and metadata, added rows carry valid contract fields', () => {
  const form = hydrateLease(base);
  form.fees[0].amount = '35';
  form.fees.push({ name: 'Application', amount: '20', dueDate: '2026-11-03' });
  form.leaseDeposits[0].amount = '60';
  form.leaseKeys[0].copies = '3';
  form.parking.customRules = 'Lot A';
  form.dirtyFields = ['fees', 'leaseDeposits', 'leaseKeys', 'parking', 'builtBefore1978'];
  form.builtBefore1978 = true;
  const payload = leasePayload(form, false);
  assert.equal(payload.fees[0].id, 7); assert.equal(payload.fees[0].amount, 35); assert.equal(payload.fees[0].isLateFee, true);
  assert.equal(payload.fees[1].amount, 20); assert.equal(payload.leaseDeposits[0].sortOrder, 3);
  assert.equal(payload.leaseKeys[0].copies, 3); assert.equal(payload.parking.id, 10);
  assert.equal(payload.parking.customRules, 'Lot A'); assert.equal(payload.builtBefore1978, true);
});
test('invalid expanded row values are rejected even for drafts; empty create does not send collections', () => {
  const form = hydrateLease(base);
  for (const [field, value] of [['amount', '-4'], ['dueDate', '2026-02-30']]) {
    assert.ok(validateLease({ ...form, fees: [{ ...form.fees[0], [field]: value }] }, true));
  }
  assert.ok(validateLease({ ...form, leaseKeys: [{ ...form.leaseKeys[0], copies: '1.5' }] }, true));
  assert.ok(validateLease({ ...form, pets: [{ type: 'Dog', weight: '-3' }], dirtyFields: ['pets'] }, true));
  assert.equal(Object.hasOwn(leasePayload(emptyLease(), true), 'fees'), false);
});
test('edited JSON options must match the backend string formats', () => {
  const form = hydrateLease(base);
  assert.ok(validateLease({ ...form, rentCollectionOtherOptions: '["cash"]', dirtyFields: ['rentCollectionOtherOptions'] }, true));
  assert.equal(validateLease({ ...form, rentCollectionOtherOptions: '{"cash":true}', dirtyFields: ['rentCollectionOtherOptions'] }, true), null);
  assert.ok(validateLease({ ...form, maintenanceNotificationMethods: '{"email":true}', dirtyFields: ['maintenanceNotificationMethods'] }, true));
  assert.ok(validateLease({ ...form, parking: { parkingTypes: 'invalid' }, dirtyFields: ['parking'] }, true));
});
test('edits to a row merge against the fresh snapshot without dropping other web edits', () => {
  const form = hydrateLease(base);
  form.fees[0].amount = '37';
  form.parking.customRules = 'Updated';
  form.dirtyFields = ['fees', 'parking'];
  form.original = { ...base, Fees: [{ ...base.Fees[0], Name: 'New from web' }], Parking: { ...base.Parking, ParkingTypes: '["driveway"]' } };
  const result = leasePayload(form, false);
  assert.equal(result.fees[0].name, 'New from web');
  assert.equal(result.fees[0].amount, 37);
  assert.equal(result.parking.parkingTypes, '["driveway"]');
  assert.equal(result.parking.customRules, 'Updated');
});
test('payload keys conform to UpdateLeaseDto and row DTO properties', () => {
  const dto = readFileSync(new URL('../../property-peace-api/Dtos/Lease/UpdateLeaseDto.cs', import.meta.url), 'utf8');
  const allowed = new Set([...dto.matchAll(/public\s+[\w?<>]+\s+(\w+)\s*\{\s*get;/g)].map(match => match[1].toLowerCase()));
  const form = hydrateLease(base);
  form.dirtyFields = ['fees', 'leaseDeposits', 'parking'];
  const payload = leasePayload(form, false);
  for (const key of Object.keys(payload)) assert.ok(allowed.has(key.toLowerCase()), `Unexpected UpdateLeaseDto key: ${key}`);
  for (const [key, file] of [['fees', 'LeaseFeeDto'], ['leaseDeposits', 'LeaseDepositDto'], ['parking', 'ParkingDto']]) {
    const text = readFileSync(new URL(`../../property-peace-api/Dtos/Lease/${file}.cs`, import.meta.url), 'utf8');
    const props = new Set([...text.matchAll(/public\s+[\w?<>]+\s+(\w+)\s*\{\s*get;/g)].map(match => match[1].toLowerCase()));
    const records = key === 'parking' ? [payload[key]] : payload[key];
    for (const record of records) for (const field of Object.keys(record)) assert.ok(props.has(field.toLowerCase()), `${file}.${field}`);
  }
});

test('screen exposes expanded groups and no fake attachment/signature inputs', () => {
  const screen = readFileSync(new URL('../src/screens/landlord/AddLeaseScreen.tsx', import.meta.url), 'utf8');
  for (const field of ['fees', 'leaseDeposits', 'rentCollectionByPlatform', 'tenantMailingCity', 'leaseOccupants', 'pets', 'parking', 'utilityServiceResponsibilities', 'leaseKeys', 'builtBefore1978']) assert.ok(screen.includes(field), field);
  assert.ok(screen.includes('accessibilityState={{ expanded:'));
});
