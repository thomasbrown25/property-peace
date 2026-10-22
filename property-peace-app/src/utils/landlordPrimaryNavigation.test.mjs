import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landlordPrimaryLinks, activeLandlordPrimaryLink } from './landlordPrimaryNavigation.js';

test('owner header presents four working destinations in reference order', () => {
  assert.deepEqual(landlordPrimaryLinks, [
    { label: 'Today', to: '/landlord/dashboard' },
    { label: 'Calendar', to: '/landlord/calendar' },
    { label: 'Listings', to: '/landlord/listings' },
    { label: 'Properties', to: '/landlord/properties' }
  ]);
});

test('selects only the current workspace, including nested listings and property details', () => {
  assert.equal(activeLandlordPrimaryLink('/landlord/dashboard', ''), 'Today');
  assert.equal(activeLandlordPrimaryLink('/landlord/dashboard', '?tab=overview'), 'Today');
  assert.equal(activeLandlordPrimaryLink('/landlord/calendar', ''), 'Calendar');
  assert.equal(activeLandlordPrimaryLink('/landlord/dashboard', '?tab=calendar'), 'Calendar');
  assert.equal(activeLandlordPrimaryLink('/landlord/dashboard', '?tab=tasks'), null);
  assert.equal(activeLandlordPrimaryLink('/landlord/listings/123', ''), 'Listings');
  assert.equal(activeLandlordPrimaryLink('/landlord/properties/123', ''), 'Properties');
  assert.equal(activeLandlordPrimaryLink('/landlord/settings', ''), null);
});
