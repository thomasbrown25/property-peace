import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const propertySource = readFileSync(new URL('./PropertyRecordsTabs.jsx', import.meta.url), 'utf8');
const listingSource = readFileSync(new URL('../../../pages/landlord/listing-detail.jsx', import.meta.url), 'utf8');

test('property tabs match listing detail spacing, bottom border, and interaction styles', () => {
  const listingStyle = listingSource.match(/<Box sx=\{\{ (mt: 0\.5,[\s\S]*?)\}\}>\s*<Tabs/);
  const propertyStyle = propertySource.match(/<Box sx=\{theme => \(\{ (mt: 0\.5,[\s\S]*?)\}\)\}>\s*<Tabs/);
  assert.ok(listingStyle, 'listing tab styles exist');
  assert.ok(propertyStyle, 'property tab styles exist');
  assert.equal(propertyStyle[1].replace(/\s+/g, ' ').trim(), listingStyle[1].replace(/\s+/g, ' ').trim());
});

test('property tabs retain scrollable navigation and all property sections', () => {
  assert.match(propertySource, /variant="scrollable" scrollButtons="auto" aria-label="Property sections"/);
  for (const tab of ['overview', 'leases', 'tenants', 'maintenances', 'finances', 'occupancy', 'documents']) {
    assert.ok(propertySource.includes(`<Tab value="${tab}"`));
  }
});
