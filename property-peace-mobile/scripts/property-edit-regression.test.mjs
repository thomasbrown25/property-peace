import test from 'node:test';
import assert from 'node:assert/strict';
import { prefillProperty, propertyPayload } from '../src/features/properties/propertyForms.ts';

test('property editor hydrates numeric enum and preserves listing date during update', () => {
  const original = { Id: 7, Name: 'Building', StreetAddress: '2 Oak', City: 'Austin', State: 'TX', ZipCode: '78701', PropertyType: 1, DateListed: '2024-04-05T12:00:00', LandlordId: 3 };
  const form = prefillProperty(original);
  assert.equal(form.propertyType, 'multiUnit');
  const payload = propertyPayload(form, original);
  assert.equal(payload.propertyType, 'multiUnit');
  assert.equal(payload.dateListed, original.DateListed);
});
