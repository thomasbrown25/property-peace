import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { leasesForView, tenantLeaseDate, tenantLeaseMoney } from '../src/features/leases/tenantLeaseModel.ts';
import { createTenantPaymentsAPI } from '../src/api/tenantPaymentsAPI.ts';

const file = name => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('active and history tabs partition tenant leases without losing inactive records', () => {
  const leases = [{ id: 1, isActive: true }, { id: 2, isActive: false }, { id: 3 }];
  assert.deepEqual(leasesForView(leases, 'active').map(x => x.id), [1]);
  assert.deepEqual(leasesForView(leases, 'history').map(x => x.id), [2, 3]);
});

test('dates do not shift across timezones, missing terms are not fabricated', () => {
  assert.equal(tenantLeaseDate('2026-01-01T00:00:00Z'), 'Jan 1, 2026');
  assert.equal(tenantLeaseDate('2026-02-30'), 'Not set');
  assert.equal(tenantLeaseMoney(null), 'Not set');
  assert.equal(tenantLeaseMoney(0), '$0.00');
});

test('list and detail read only the tenant-scoped API', async () => {
  const calls = [];
  const api = createTenantPaymentsAPI({ get: async url => { calls.push(url); return { success: true, data: [{ id: 4, isActive: true }] }; }, post: async () => {} });
  assert.equal((await api.leases())[0].id, 4);
  assert.deepEqual(calls, ['/api/lease/tenant/my-leases']);
  const [screen, nav, dock] = await Promise.all([file('screens/tenant/TenantLeasesScreen.tsx'), file('navigation/MainNavigator.tsx'), file('navigation/QuickActionsTabBar.tsx')]);
  assert.match(screen, /api\.leases\(\)/);
  assert.doesNotMatch(screen, /LeaseAPI\.getLeases/);
  assert.match(screen, /accessibilityRole="tab"/);
  assert.match(screen, /navigate\('TenantLeaseDetail', \{ leaseId: item\.id \}\)/);
  assert.match(nav, /audience === 'tenant' && <Tab.Screen name="Leases" component=\{TenantLeasesNavigator\}/);
  assert.match(dock, /label: 'Leases'[^\n]*route: 'Leases'/);
});
