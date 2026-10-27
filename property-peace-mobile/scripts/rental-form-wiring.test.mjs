import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const src = (name) => readFileSync(new URL(`../src/screens/landlord/${name}`, import.meta.url), 'utf8');
test('listings use a native form, edit details, no web handoff', () => {
  const screen = src('ListingsScreen.tsx');
  assert.match(screen, /ListingFormModal/);
  assert.match(screen, /Edit listing/);
  assert.doesNotMatch(screen, /Linking|WEB_APP_URL|openURL/);
  assert.match(src('ListingFormModal.tsx'), /saveListing\(form, currentId\)/);
  assert.match(src('ListingFormModal.tsx'), /savedId \?\? item\?\.id/);
});
test('applications offer invite OR manual create and native edit', () => {
  const screen = src('ApplicationsScreen.tsx');
  assert.match(screen, /Enter application myself/);
  assert.match(screen, /Invite applicant by email/);
  assert.match(screen, /Edit application/);
  assert.match(src('ApplicationFormModal.tsx'), /saveApplication\(form, item\?\.id\)/);
});
test('edit forms validate against the fully loaded original before reporting a save', () => {
  const listing = src('ListingFormModal.tsx');
  const application = src('ApplicationFormModal.tsx');
  assert.match(listing, /setOriginal\(loaded\)/);
  assert.match(listing, /listingError\(form, requiresUnit, original/);
  assert.match(listing, /item && !original/);
  assert.match(application, /setOriginal\(loaded\)/);
  assert.match(application, /applicationError\(form, !!item, requiresUnit, original/);
  assert.match(application, /item && !original/);
});
