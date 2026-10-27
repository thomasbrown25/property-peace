import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listingInitial, listingPayload, listingError } from '../src/features/rentals/listingForm.ts';

test('listing setup prefills amenities and settings, preserving empty selections on edit', () => {
  const form = listingInitial({ PropertyId: 2, MonthlyRent: 900, RequireScreening: true, ScreeningType: 1, IncomeVerificationCost: 12, SyndicateToFreeSites: true, BasicAmenities: [{ Id: 3 }], PropertyAmenities: [{ Id: 4, IsCustom: false }, { Id: 5, IsCustom: true }], PropertyFeatures: [{ Id: 6, IsCustom: true }] });
  assert.deepEqual(form.basicAmenityIds, [3]);
  assert.deepEqual(form.defaultAmenityIds, [4]);
  assert.deepEqual(form.customAmenityIds, [5]);
  assert.deepEqual(form.customFeatureIds, [6]);
  assert.equal(form.requireScreening, true);
  assert.equal(form.screeningType, '1');
  assert.equal(form.syndicateToFreeSites, true);
  const payload = listingPayload({ ...form, basicAmenityIds: [] }, true);
  assert.deepEqual(payload.basicAmenityIds, []);
  assert.equal(payload.requireScreening, true);
  assert.equal(payload.screeningType, 1);
  assert.equal(payload.incomeVerificationCost, 12);
});

test('native listing setup wires catalogs, multipart uploads and photo controls without web handoff', () => {
  const modal = readFileSync(new URL('../src/screens/landlord/ListingFormModal.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/api/listingAPI.ts', import.meta.url), 'utf8');
  assert.match(modal, /getListingOptions\(\)/);
  assert.match(modal, /uploadListingPhotos\(result\.id, pendingPhotos\)/);
  assert.match(modal, /setListingCover\(currentId!, photo\.id\)/);
  assert.match(modal, /deleteListingPhoto\(photo\.id\)/);
  assert.match(modal, /saveListing\(form, currentId\)/);
  assert.doesNotMatch(modal, /Linking|openURL/);
  assert.match(api, /body\.append\('files', file as any\)/);
  assert.match(api, /body\.append\(`\$\{key\}\[\$\{index\}\]`/);
});

test('listing setup validates conditional fee and screening values', () => {
  const base = listingInitial({ PropertyId: 1 });
  assert.match(listingError({ ...base, applicationFeeRequired: true, applicationFee: '0' }, false), /application fee/i);
  assert.match(listingError({ ...base, requireScreening: true, screeningType: '' }, false), /screening type/i);
  assert.equal(listingError({ ...base, applicationFeeRequired: true, applicationFee: '25' }, false), '');
});
