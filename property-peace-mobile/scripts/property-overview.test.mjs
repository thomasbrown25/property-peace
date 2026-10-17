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
const { propertyOpenRepairs, propertyRentDue } = module.exports;

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

test('property page uses scoped API responses and reserves neutral color for zero or failed counts', () => {
  const page = readFileSync(new URL('../src/screens/landlord/PropertyDetailScreen.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/api/rentCollectionAPI.ts', import.meta.url), 'utf8');
  assert.match(page, /MaintenanceAPI\.getCurrent\(\)/);
  assert.match(page, /RentCollectionAPI\.getRentCollection\(propertyId\)/);
  assert.match(page, /propertyRentDue\(data\.rentRecords \?\? data\.RentRecords, propertyId\)/);
  assert.match(page, /<Snapshot label="Rent due" value=\{rentDue === null \? '—' : currency\(rentDue\)\}/);
  assert.match(page, /`\$\{openRepairs\} open repairs`/);
  assert.match(page, /titleColor=\{openRepairs !== null && openRepairs > 0 \?/);
  assert.match(api, /propertyId=\$\{encodeURIComponent\(String\(propertyId\)\)\}/);
});
