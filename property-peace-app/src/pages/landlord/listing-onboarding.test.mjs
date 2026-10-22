import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const source = (file) => fs.readFileSync(new URL(file, `file://${directory}`), 'utf8');

test('Google address components populate editable confirmation fields', async () => {
  const { parseListingAddress } = await import('./listing-address.mjs');
  const parsed = parseListingAddress({ addressComponents: [
    { types: ['street_number'], longText: '123' },
    { types: ['route'], longText: 'Main Street' },
    { types: ['locality'], longText: 'Austin' },
    { types: ['administrative_area_level_1'], shortText: 'TX' },
    { types: ['postal_code'], longText: '78701' },
    { types: ['country'], shortText: 'US' }
  ] });
  assert.deepEqual(parsed, { streetAddress: '123 Main Street', unit: '', city: 'Austin', state: 'TX', zipCode: '78701', country: 'US' });
});

test('legacy Google details and subpremise are supported without fabricated values', async () => {
  const { parseListingAddress } = await import('./listing-address.mjs');
  assert.deepEqual(parseListingAddress({ addressComponents: [
    { types: ['route'], long_name: 'Oak Avenue' },
    { types: ['subpremise'], long_name: 'Unit 4' },
    { types: ['postal_town'], long_name: 'Springfield' }
  ] }), { streetAddress: 'Oak Avenue', unit: 'Unit 4', city: 'Springfield', state: '', zipCode: '', country: '' });
});

test('add-listing actions open the standalone onboarding, not the old drawer', () => {
  const listings = source('listings.jsx');
  assert.match(listings, /navigate\('\/landlord\/listings\/add'\)/);
  assert.doesNotMatch(listings, /onClick=\{\(\) => drawer\.openListingAddDrawer\(\)\}/);
  const onboarding = source('listing-create.jsx');
  for (const label of ['Welcome back', 'Start a new listing', 'Create a new listing', 'Set up your Property Peace listing', 'Tell us about your place', 'Save &amp; exit']) {
    assert.ok(onboarding.includes(label), `Missing ${label}`);
  }
  assert.match(onboarding, /usePlacesSuggestions/);
  assert.match(onboarding, /toPlaceDetails/);
  assert.match(onboarding, /<Dialog[^\n]*zIndex: 1500/);
});

test('shared add-property/add-listing accents use the app green and Next buttons use navy with white text', () => {
  const onboarding = source('listing-create.jsx');
  assert.match(onboarding, /outlineColor: 'success.main'/);
  assert.match(onboarding, /color: 'success.dark'/);
  assert.match(onboarding, /borderColor: 'success.dark'/);
  assert.doesNotMatch(onboarding, /#25755f|#096b55|#06815e/);
  assert.match(onboarding, /<Button variant="contained" fullWidth onClick=\{confirmAddress\} sx=\{\{ \.\.\.primaryButton, mt: 3 \}\}>Next<\/Button>/);
  assert.match(onboarding, /sx=\{primaryButton\}>Next<\/Button>/);
  const property = source('property-add-workflow.jsx');
  assert.match(property, /variant="contained"\s+color="primary"\s+onClick=\{handleNext\}/);
});

test('address search opens tall and uncluttered, without manual-entry controls', () => {
  const onboarding = source('listing-create.jsx');
  assert.match(onboarding, /minHeight: modalStep === 'search' \? 'min\(72vh, 690px\)'/);
  assert.match(onboarding, /aria-label="Enter your address" placeholder="Enter your address"/);
  assert.doesNotMatch(onboarding, /label="Street address" placeholder=/);
  assert.doesNotMatch(onboarding, /Enter address manually|Address suggestions provided by Google|enter it manually/);
  assert.match(onboarding, /toPlaceDetails\(suggestion/);
});
