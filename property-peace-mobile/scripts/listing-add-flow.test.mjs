import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const form = read('screens/landlord/ListingFormModal.tsx');
const list = read('screens/landlord/ListingsScreen.tsx');
const nav = read('navigation/MainNavigator.tsx');
const types = read('navigation/types.ts');

test('New listing opens a dedicated stack screen while edit retains pageSheet modal', () => {
  assert.match(types, /AddListing: \{ scope: string \}/);
  assert.match(nav, /<ListingsStack\.Screen name="AddListing" component=\{AddListingScreen\}/);
  assert.match(list, /navigation\.navigate\('AddListing', \{ scope \}\)/);
  assert.match(list, /ListingFormModal visible=\{edit\} scope=\{route\.params\.scope\} item=\{current\}/);
  assert.match(form, /presentationStyle="pageSheet"/);
  assert.match(list, /route\.params\.scope !== currentScope/);
});

test('step transitions require a successful server save and retain the created id', () => {
  assert.match(form, /listingError\(form, requiresUnit, original \?\? undefined\)/);
  assert.match(form, /result = await saveListing\(form, currentId\)/);
  assert.match(form, /setSavedId\(Number\(result\.id\)\)/);
  assert.match(form, /if \(addPage && step < 4\) \{ setStep\(step \+ 1\); return; \}/);
  assert.match(form, /if \(creating && addPage\) \{ setUncertainCreate\(true\)/);
  assert.match(form, /submitting\.current = true/);
  assert.match(form, /uploadListingPhotos\(result\.id, pendingPhotos\)/);
  assert.doesNotMatch(form, /publishListing\(/);
});

test('wizard isolates fields by step and warns before losing unsaved edits', () => {
  assert.match(form, /STEP \{step \+ 1\} OF 5/);
  assert.match(form, /groups\.filter\(\(_, index\) => !addPage/);
  assert.match(form, /\(!addPage \|\| step === 3\) && <>\{section\('Amenities & features'\)\}/);
  assert.match(form, /\(!addPage \|\| step === 4\) && <>\{section\('Photos'\)\}/);
  assert.match(list, /navigation\.addListener\('beforeRemove'/);
  assert.match(list, /event\.preventDefault\(\)/);
  assert.match(form, /onDirtyChange\?\.\(JSON\.stringify\(form\)/);
});
