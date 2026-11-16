import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('tenant directory is a guarded standalone page with the existing directory and add drawer', () => {
  const routes = source('../routes/MainRoutes.jsx');
  const page = source('../pages/landlord/tenants.jsx');
  const directory = source('../sections/landlord/tenants/TenantsContent.jsx');
  assert.match(routes, /path: 'landlord\/tenants',\s*element: \(\s*<SubscriptionPausedGuard>\s*<Tenants \/>/);
  assert.match(routes, /get\('tab'\) === 'tenants'[\s\S]*<Navigate to="\/landlord\/tenants" replace \/>/);
  assert.match(page, /<TenantsContent \/>/);
  assert.match(page, /<TenantAddDrawer \/>/);
  assert.doesNotMatch(page, /<Tabs\b|<Tab\b/);
  assert.match(directory, /<ManagementPageHeader[\s\S]*title="Tenants"[\s\S]*description=/);
  assert.match(directory, /data-testid="tenant-filters"[\s\S]*data-testid="tenant-table"/);
});

test('leases retains only lease and agreement tabs, and direct tenant links use the new route', () => {
  const leases = source('../pages/landlord/leases.jsx');
  assert.doesNotMatch(leases, /<TenantsContent|<TenantAddDrawer|<TabPanel[^>]*index=\{2\}/);
  assert.match(leases, /<TabPanel key="leases"/);
  assert.match(leases, /<TabPanel key="lease-agreements"/);
  for (const page of ['tenant.jsx', 'tenant-import.jsx']) {
    assert.doesNotMatch(source(`../pages/landlord/${page}`), /\/landlord\/leases\?tab=tenants/);
  }
});
