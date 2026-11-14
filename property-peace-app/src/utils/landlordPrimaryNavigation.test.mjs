import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landlordPrimaryLinks, landlordMoreLinks, activeLandlordPrimaryLink } from './landlordPrimaryNavigation.js';

test('outer navigation presents the requested primary destinations in order', () => {
  assert.deepEqual(landlordPrimaryLinks, [
    { label: 'Home', to: '/landlord/dashboard' },
    { label: 'Tenants', to: '/landlord/tenants' },
    { label: 'Maintenance', to: '/landlord/maintenances' },
    { label: 'Finances', to: '/landlord/finances' },
    { label: 'Documents', to: '/landlord/documents' }
  ]);
  for (const label of ['Calendar', 'Listings', 'Bookings', 'Leases', 'Reports', 'Settings', 'Help']) {
    assert.ok(landlordMoreLinks.some((link) => link.label === label));
  }
});

test('selects the correct primary section for list pages, details, and secondary tools', () => {
  for (const [path, expected] of [
    ['/landlord', 'Home'], ['/landlord/dashboard', 'Home'], ['/landlord/properties', 'Properties'],
    ['/landlord/property/123', 'Properties'], ['/landlord/properties/123', 'Properties'],
    ['/landlord/unit/123', 'Properties'], ['/landlord/tenants/12', 'Tenants'],
    ['/landlord/maintenances', 'Maintenance'], ['/landlord/maintenance/12', 'Maintenance'],
    ['/landlord/finances', 'Finances'], ['/landlord/accounting/expenses', 'Finances'],
    ['/landlord/documents', 'Documents'], ['/landlord/files', 'Documents'],
    ['/landlord/calendar', 'More'], ['/landlord/listings/123', 'More'],
    ['/landlord/bookings/123', 'More'], ['/landlord/settings', 'More'], ['/admin/dashboard', null]
  ]) assert.equal(activeLandlordPrimaryLink(path), expected, path);
  assert.equal(activeLandlordPrimaryLink('/landlord/dashboard', '?tab=calendar'), 'More');
  assert.equal(activeLandlordPrimaryLink('/landlord/dashboard', '?tab=tasks'), 'Home');
  assert.equal(activeLandlordPrimaryLink('/landlord/leases', '?tab=tenants'), 'Tenants');
  assert.equal(activeLandlordPrimaryLink('/landlord/leases', '?tab=leases'), 'More');
});
