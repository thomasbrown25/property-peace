import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mobile = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('tenant documents have a side-menu destination without changing the five-slot dock', async () => {
  const [menu, nav, screen, api] = await Promise.all([
    mobile('navigation/QuickActionsTabBar.tsx'), mobile('navigation/MainNavigator.tsx'),
    mobile('screens/tenant/TenantDocumentsScreen.tsx'), mobile('api/tenantDocumentsAPI.ts'),
  ]);
  const tenantMenu = menu.slice(menu.indexOf('const tenantMenu:'), menu.indexOf('// Do not send a development/preview'));
  assert.match(tenantMenu, /label: 'Documents'[^\n]*route: 'Documents'/);
  assert.match(nav, /audience === 'tenant' && <Tab.Screen name="Documents" component={TenantDocumentsScreen}/);
  assert.match(menu, /audience === 'tenant' && route\.name === 'Documents'/);
  assert.match(screen, /<LandlordPageHeader title="Documents"/);
  assert.match(screen, /paddingBottom: Math\.max\(insets\.bottom, 24\) \+ 100/);
  assert.match(screen, /result\?\.scope === scope/);
  assert.match(api, /\/api\/TenantDocument\/tenant\/my-documents/);
  assert.doesNotMatch(api, /\/tenant\/\$\{/);
  assert.match(screen, /DocumentPicker\.getDocumentAsync/);
  assert.match(screen, /Upload files/);
  assert.match(api, /form\.append\('files'/);
});

test('tenant self-document route is role-limited and repository filters private and other tenants’ files', async () => {
  const root = new URL('../../property-peace-api/', import.meta.url);
  const [controller, repo] = await Promise.all([
    readFile(new URL('Controllers/TenantDocumentController.cs', root), 'utf8'),
    readFile(new URL('Repositories/TenantDocuments/TenantDocumentRepository.cs', root), 'utf8'),
  ]);
  assert.match(controller, /\[Authorize\(Roles = "Tenant"\)\]\s*\[TenantSelfOrganization\]\s*\[HttpGet\("tenant\/my-documents"\)\]/);
  assert.match(controller, /\[Authorize\(Roles = "Tenant"\)\]\s*\[TenantSelfOrganization\]\s*\[HttpPost\("tenant\/my-documents"\)\]/);
  const ownQuery = repo.slice(repo.indexOf('public async Task<List<LoadTenantDocumentDto>> GetMyTenantDocuments'), repo.indexOf('public async Task<List<LoadTenantDocumentDto>> GetTenantDocumentsByLandlordId'));
  for (const predicate of ['!d.IsPrivate', 'd.Tenant.UserId == userId', '!d.TenantId.HasValue', 'd.Lease.TenantLeases.Any', 'd.Lease.Unit.Property.OrganizationId == organizationId']) {
    assert.ok(ownQuery.includes(predicate), `Missing ${predicate}`);
  }
});
