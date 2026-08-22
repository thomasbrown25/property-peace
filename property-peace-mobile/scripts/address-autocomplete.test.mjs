import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyGooglePlaceDetails,
  createLatestRequestGate,
  nextAddressSessionToken,
  shouldFetchAddressSuggestions,
} from '../src/features/properties/addressAutocomplete.ts';

test('requests suggestions only after three trimmed characters', () => {
  assert.equal(shouldFetchAddressSuggestions(' 12 '), false);
  assert.equal(shouldFetchAddressSuggestions(' 123 '), true);
});

test('only the newest request may update visible suggestions', () => {
  const gate = createLatestRequestGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(second), false);
});

test('selection fills address fields and an empty property name', () => {
  const result = applyGooglePlaceDetails(
    {
      name: '',
      address: '123 Ma',
      city: '',
      state: '',
      zipCode: '',
      propertyType: 'Residential',
    },
    {
      placeId: 'place-1',
      formattedAddress: '123 Main Street, Raleigh, NC 27601, USA',
      streetAddress: '123 Main Street',
      city: 'Raleigh',
      state: 'NC',
      zipCode: '27601',
      latitude: 35.77,
      longitude: -78.63,
    },
  );
  assert.deepEqual(result, {
    name: '123 Main Street',
    address: '123 Main Street',
    city: 'Raleigh',
    state: 'NC',
    zipCode: '27601',
    propertyType: 'Residential',
  });
});

test('selection preserves an entered name and manual missing values', () => {
  const result = applyGooglePlaceDetails(
    {
      name: 'Oak House',
      address: '12 O',
      city: 'Manual City',
      state: 'VA',
      zipCode: '22000',
      propertyType: 'Residential',
    },
    {
      placeId: 'place-2',
      formattedAddress: '',
      streetAddress: '12 Oak Ave',
      city: '',
      state: '',
      zipCode: '',
      latitude: null,
      longitude: null,
    },
  );
  assert.equal(result.name, 'Oak House');
  assert.equal(result.address, '12 Oak Ave');
  assert.equal(result.city, 'Manual City');
  assert.equal(result.state, 'VA');
  assert.equal(result.zipCode, '22000');
});

test('clearing a completed input starts a new session on the next entry', () => {
  const tokens = ['session-1', 'session-2'];
  const createToken = () => tokens.shift();
  const first = nextAddressSessionToken('', '123 Main', null, createToken);
  const same = nextAddressSessionToken('123 Main', '123 Main S', first, createToken);
  const cleared = nextAddressSessionToken('123 Main S', '', same, createToken);
  assert.equal(first, 'session-1');
  assert.equal(same, 'session-1');
  assert.equal(cleared, null);
  assert.equal(
    nextAddressSessionToken('', '4 Oak', cleared, createToken),
    'session-2',
  );
});