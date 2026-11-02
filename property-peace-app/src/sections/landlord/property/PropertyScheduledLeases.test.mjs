import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

test('property page omits the scheduled leases section while retaining the overview', () => {
  const page = source('../../../pages/landlord/property.jsx');
  assert.doesNotMatch(page, /PropertyScheduledLeases/);
  assert.match(page, /<PropertyRecordsTabs[\s\S]*?property=\{selectedProperty\}/);
});

test('permission denial does not invite unauthorized creation or show a retry warning', () => {
  const card = source('./PropertyScheduledLeases.jsx');
  assert.match(card, /setForbidden\(.*403/);
  assert.match(card, /if \(forbidden\) return null/);
});

test('scheduled card requests property-scoped list and links contracts by their own IDs', () => {
  const card = source('./PropertyScheduledLeases.jsx');
  assert.match(card, /\/api\/lease\/property\/\$\{propertyId\}/);
  assert.match(card, /scheduledPropertyLeases\(property, leases,/);
  assert.match(card, /\/landlord\/leases\/\$\{leaseId\}/);
  assert.match(card, /openLeaseAddDrawer/);
  assert.match(card, /through its end date/i);
});
