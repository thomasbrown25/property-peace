import test from 'node:test';
import assert from 'node:assert/strict';

import pages from './pages.js';

const landlordDestinations = pages.find(({ id }) => id === 'group-landlord-navigation')?.children ?? [];
const topLevelIds = landlordDestinations.map(({ id }) => id);

test('Portfolio is the first landlord destination after Dashboard', () => {
  assert.equal(topLevelIds[0], 'dashboard');
  assert.equal(topLevelIds[1], 'portfolio');
});

test('Operations is the first landlord destination after Portfolio', () => {
  const portfolioIndex = topLevelIds.indexOf('portfolio');

  assert.notEqual(portfolioIndex, -1);
  assert.equal(topLevelIds[portfolioIndex + 1], 'operations');
});

test('Accounting exposes only the consolidated finance destinations in their approved order', () => {
  const accounting = landlordDestinations.find(({ id }) => id === 'accounting');

  assert.ok(accounting, 'missing Accounting navigation group');
  assert.deepEqual(
    accounting.children.map(({ id, title, url }) => ({ id, title, url })),
    [
      { id: 'finances', title: 'Finances', url: '/landlord/finances' },
      { id: 'rent-collection', title: 'Rent Collection', url: '/landlord/rent-collection' },
      { id: 'tax-center', title: 'Tax Center', url: '/landlord/accounting/tax-center' },
      { id: 'reports-analytics', title: 'Reports & Analytics', url: '/landlord/reports' }
    ]
  );
});

test('Money Center and standalone finance-list destinations are absent', () => {
  assert.equal(
    landlordDestinations.some(({ id }) => id === 'money-center'),
    false
  );

  const allItems = landlordDestinations.flatMap((destination) => [destination, ...(destination.children ?? [])]);
  for (const retiredId of ['money', 'payments', 'expenses', 'ledger']) {
    assert.equal(
      allItems.some(({ id }) => id === retiredId),
      false,
      'found retired ' + retiredId + ' navigation item'
    );
  }
});
