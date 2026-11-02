import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('./listing-create.jsx', import.meta.url), 'utf8');

test('listing uses organization-scoped properties rather than creating a new address', () => {
  assert.match(page, /useFetchProperties\(\)/);
  assert.match(page, /<TextField select fullWidth label="Select property"/);
  assert.match(page, /properties\.map\(\(property\) => <MenuItem/);
  assert.match(page, /disabled=\{!selectedProperty\}/);
  assert.match(page, /propertyMode \? <Box component="button" id="listing-address-trigger"/);
  assert.match(page, /propertyMode \? address\.streetAddress : selectedProperty/);
});

test('empty and failed property responses do not masquerade as selectable properties', () => {
  assert.match(page, /propertiesReady && !properties\.length \? 'Add a property first'/);
  assert.match(page, /To create a listing, add your property to Property Peace first/);
  assert.match(page, /navigate\('\/landlord\/properties\/add'\)/);
  assert.match(page, /propertiesError \? <Stack[\s\S]*?onClick=\{propertiesRefetch\}>Retry/);
  assert.match(page, /propertiesLoading \|\| !propertiesLoadedAt \? <CircularProgress/);
});

test('listing screens have no green numbered chapter labels', () => {
  assert.doesNotMatch(page, /STEP [123] ·/);
  assert.match(page, /propertyMode \? \([\s\S]*?Step 1/);
});
