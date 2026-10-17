import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/features/properties/propertyOverview.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
const scope = { forProperty: (requests, id) => requests.filter(item => String(item.propertyId ?? item.PropertyId ?? '') === id) };
new Function('module', 'exports', 'require', js)(module, module.exports, (id) => {
  if (id === '../maintenance/propertyMaintenanceScope') return scope;
  throw new Error(`Unexpected import: ${id}`);
});
const { propertyOpenRepairs, propertyRentDue, propertyOverdueRent, propertyRentStatus } = module.exports;

test('counts only open repairs belonging to the property', () => {
  assert.equal(propertyOpenRepairs([{ propertyId: 7 }, { PropertyId: '7' }, { propertyId: 8 }, {}], '7'), 2);
  assert.equal(propertyOpenRepairs([], '7'), 0);
});

test('sums accrued unpaid rent only for matching property, including prior periods', () => {
  assert.equal(propertyRentDue([
    { propertyId: 7, rentDue: 125.5, rentAmount: 1800 },
    { PropertyId: '7', RentDue: 250, RentAmount: 2000 },
    { propertyId: 8, rentDue: 400 },
  ], '7'), 375.5);
  assert.equal(propertyRentDue([{ propertyId: 7, rentDue: 0 }], '7'), 0);
  assert.throws(() => propertyRentDue([{ propertyId: 7, rentAmount: 1200 }], '7'));
  assert.throws(() => propertyRentDue(null, '7'));
});

test('detects overdue rent for this property from overdue amounts, not rent due or unit status', () => {
  assert.equal(propertyOverdueRent([
    { propertyId: 7, overdueAmount: 0, rentDue: 500 },
    { PropertyId: '7', OverdueAmount: 12.5, RentDue: 12.5 },
    { propertyId: 8, overdueAmount: 200 },
  ], '7'), true);
  assert.equal(propertyOverdueRent([{ propertyId: 7, overdueAmount: 0, rentDue: 500 }, { propertyId: 8, overdueAmount: 100 }], '7'), false);
  assert.equal(propertyOverdueRent([], '7'), false);
  assert.throws(() => propertyOverdueRent([{ propertyId: 7, rentDue: 100 }], '7'));
  assert.throws(() => propertyOverdueRent(null, '7'));
});

test('rent status distinguishes overdue, current due, settled, empty and invalid property records', () => {
  assert.equal(propertyRentStatus([{ propertyId: 7, rentDue: 50, overdueAmount: 10 }], '7'), 'overdue');
  assert.equal(propertyRentStatus([{ PropertyId: '7', RentDue: 50, OverdueAmount: 0 }], '7'), 'due');
  assert.equal(propertyRentStatus([{ propertyId: 7, rentDue: 0, overdueAmount: 0 }, { propertyId: 8, rentDue: 300, overdueAmount: 300 }], '7'), 'paid');
  assert.equal(propertyRentStatus([{ propertyId: 8, rentDue: 0, overdueAmount: 0 }], '7'), 'no-records');
  assert.throws(() => propertyRentStatus([{ propertyId: 7, rentDue: 0 }], '7'));
  assert.throws(() => propertyRentStatus(null, '7'));
});

test('property page uses scoped API responses and reserves neutral color for zero or failed counts', () => {
  const page = readFileSync(new URL('../src/screens/landlord/PropertyDetailScreen.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/api/rentCollectionAPI.ts', import.meta.url), 'utf8');
  assert.match(page, /MaintenanceAPI\.getCurrent\(\)/);
  assert.match(page, /RentCollectionAPI\.getRentCollection\(propertyId\)/);
  assert.match(page, /propertyRentDue\(data\.rentRecords \?\? data\.RentRecords, propertyId\)/);
  assert.match(page, /propertyOverdueRent\(data\.rentRecords \?\? data\.RentRecords, propertyId\)/);
  assert.match(page, /propertyRentStatus\(data\.rentRecords \?\? data\.RentRecords, propertyId\)/);
  assert.match(page, /<Text style=\{styles\.paymentHeading\}>Rent status<\/Text>/);
  assert.match(page, /rentStatus === 'paid' \? 'Paid up to date'/);
  assert.match(page, /rentStatus === 'overdue' \? 'Overdue'/);
  assert.match(page, /<Snapshot label=\{rentDue !== null && overdueRent === true \? 'Overdue rent' : 'Rent due'\} value=\{rentDue === null \? '—' : currency\(rentDue\)\} alert=\{rentDue !== null && overdueRent === true\}/);
  assert.match(page, /`\$\{openRepairs\} open repairs`/);
  assert.match(page, /titleColor=\{openRepairs !== null && openRepairs > 0 \?/);
  assert.match(api, /propertyId=\$\{encodeURIComponent\(String\(propertyId\)\)\}/);
});
