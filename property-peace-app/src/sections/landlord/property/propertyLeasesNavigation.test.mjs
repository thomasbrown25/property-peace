import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('property navigation orders overview, leases, payments and mounts the property list', () => {
  const page = read('../../../pages/landlord/property.jsx');
  assert.match(page, /<Tab value="overview" label="Overview"\s*\/>[\s\S]*<Tab value="leases" label="Leases"\s*\/>[\s\S]*<Tab value="payments" label="Payments"\s*\/>/);
  assert.match(page, /tab === 'leases' && <PropertyLeasesTab propertyId=\{propertyId\}/);
});

test('property list reads all authorized leases and View all opens the scoped workspace', () => {
  const list = read('./PropertyLeasesTab.jsx');
  const controller = read('../../../../../property-peace-api/Controllers/LeaseController.cs');
  const workspace = read('../../../pages/landlord/leases.jsx');
  assert.match(list, /api\/lease\/property\/\$\{propertyId\}\/all/);
  assert.match(list, /recentPropertyLeases\(leases\)/);
  assert.match(list, /landlord\/leases\?propertyId=\$\{encodeURIComponent\(propertyId\)\}&view=all/);
  assert.match(controller, /HttpGet\("property\/\{propertyId:long\}\/all"\)/);
  assert.match(controller, /lease\.OrganizationId == organizationId && !lease\.IsDeleted/);
  assert.match(workspace, /statusFilters\.includes\('all'\)/);
  assert.match(workspace, /sourceLeases\.filter\(\(lease\) => Number\(lease\.propertyId\) === Number\(scopedProperty\.id\)\)/);
});
