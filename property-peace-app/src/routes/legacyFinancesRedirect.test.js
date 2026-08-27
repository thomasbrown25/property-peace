import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLegacyFinancesRedirect } from './legacyFinancesRedirect.js';

test('legacy redirects preserve date, unit, property, and repeated query scope while forcing the requested tab', () => {
  const destination = buildLegacyFinancesRedirect(
    '?period=custom&from=2026-07-01&to=2026-07-31&propertyId=12&unitId=3&tag=rent&tag=late&tab=review',
    { tab: 'payments' }
  );
  const redirected = new URL(destination, 'https://property-peace.test');

  assert.equal(redirected.pathname, '/landlord/finances');
  assert.equal(redirected.searchParams.get('period'), 'custom');
  assert.equal(redirected.searchParams.get('from'), '2026-07-01');
  assert.equal(redirected.searchParams.get('to'), '2026-07-31');
  assert.equal(redirected.searchParams.get('propertyId'), '12');
  assert.equal(redirected.searchParams.get('unitId'), '3');
  assert.deepEqual(redirected.searchParams.getAll('tag'), ['rent', 'late']);
  assert.deepEqual(redirected.searchParams.getAll('tab'), ['payments']);
});

test('property-scoped legacy routes fold the path property into the query using existing route precedence', () => {
  const destination = buildLegacyFinancesRedirect('?propertyId=99&unitId=4&tab=expenses', {
    tab: 'activity',
    propertyId: '42'
  });
  const redirected = new URL(destination, 'https://property-peace.test');

  assert.equal(redirected.pathname, '/landlord/finances');
  assert.equal(redirected.searchParams.get('propertyId'), '42');
  assert.equal(redirected.searchParams.get('unitId'), '4');
  assert.equal(redirected.searchParams.get('tab'), 'activity');
});

test('non-property legacy routes retain an explicit property query scope', () => {
  const destination = buildLegacyFinancesRedirect('?propertyId=99', { tab: 'expenses' });
  const redirected = new URL(destination, 'https://property-peace.test');

  assert.equal(redirected.searchParams.get('propertyId'), '99');
  assert.equal(redirected.searchParams.get('tab'), 'expenses');
});
