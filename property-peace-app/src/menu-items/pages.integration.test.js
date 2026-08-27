import test from 'node:test';
import assert from 'node:assert/strict';

import pages from './pages.js';

const expectedGroups = [
  {
    id: 'group-landlord-navigation',
    title: undefined,
    items: [
      ['dashboard', 'Dashboard', '/landlord/dashboard'],
      ['properties-page', 'Properties', '/landlord/properties'],
      ['leases', 'Leases', '/landlord/leases'],
      ['listings', 'Listings & Applications', '/landlord/listings']
    ]
  },
  {
    id: 'group-property-operations',
    title: 'Property Operations',
    items: [
      ['ai-center', 'Percy', '/landlord/ai-center'],
      ['inspections', 'Checklists', '/landlord/checklists'],
      ['maintenances', 'Maintenance', '/landlord/maintenances'],
      ['vendors', 'Vendors', '/landlord/vendors']
    ]
  },
  {
    id: 'group-admin-operations',
    title: 'Admin Operations',
    items: [
      ['admin-users', 'Team', '/landlord/admin-members'],
      ['announcements', 'Announcements', '/landlord/announcements'],
      ['messages', 'Messages', '/landlord/messages']
    ]
  },
  {
    id: 'group-accounting',
    title: 'Accounting',
    items: [
      ['finances', 'Finances', '/landlord/finances'],
      ['tax-center', 'Tax Center', '/landlord/accounting/tax-center'],
      ['reports-analytics', 'Reports', '/landlord/reports']
    ]
  }
];

test('landlord sidebar uses the approved flat groups and item order', () => {
  assert.deepEqual(
    pages.map(({ id, title, children }) => ({
      id,
      title,
      items: children.map(({ id: childId, title: childTitle, url }) => [childId, childTitle, url])
    })),
    expectedGroups
  );
});

test('landlord sidebar has no collapsible destinations', () => {
  const allDestinations = pages.flatMap(({ children = [] }) => children);

  assert.equal(allDestinations.some(({ type }) => type === 'collapse'), false);
  assert.equal(allDestinations.every(({ type }) => type === 'item'), true);
});

test('retired standalone finance destinations remain absent', () => {
  const allDestinations = pages.flatMap(({ children = [] }) => children);

  for (const retiredId of ['money-center', 'money', 'payments', 'expenses', 'ledger', 'rent-collection']) {
    assert.equal(
      allDestinations.some(({ id }) => id === retiredId),
      false,
      'found retired ' + retiredId + ' navigation item'
    );
  }
});
