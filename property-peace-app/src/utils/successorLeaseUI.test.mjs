import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

test('add drawer keeps occupied selection and checks dates before posting', () => {
  const drawer = source('../components/drawers/LeaseAddDrawer.jsx');
  assert.doesNotMatch(drawer, /if \(option\?\.hasLease && option\?\.activeLease\)/);
  assert.match(drawer, /leaseTermError\(values\.leaseStartDate, values\.leaseEndDate, selectedUnit\)/);
  assert.match(drawer, /current lease end date/i);
  assert.match(drawer, /error\?\.response\?\.data\?\.title/);
});
test('add drawer loads scoped lease list when unit collection is missing before posting', () => {
  const drawer = source('../components/drawers/LeaseAddDrawer.jsx');
  assert.match(drawer, /if \(!Array\.isArray\(selectedUnit\?\.leases/);
  assert.match(drawer, /axiosServices\.get\(`\/api\/lease\/property\/\$\{values\.propertyId\}`\)/);
  assert.match(drawer, /leases:.*filter\(/);
});

test('legacy and bulk creation validate occupied-unit boundaries', () => {
  const wizard = source('../sections/lease-builder/LeaseBuilderWizard.jsx');
  const selector = source('../sections/lease-builder/PropertyUnitSelector.jsx');
  const bulk = source('../sections/lease-builder/BulkLeaseTermsStep.jsx');
  assert.match(wizard, /leaseTermError\(startDate, endDate, selectedUnit\)/);
  assert.match(selector, /allowOccupiedUnits/);
  assert.match(bulk, /leaseTermError\(leaseTerms\.startDate, leaseTerms\.endDate, unit\)/);
});
