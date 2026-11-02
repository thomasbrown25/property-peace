import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('lease checklist card opens a lease-scoped creation route only when no matching checklist exists', () => {
  const lease = source('../pages/landlord/lease.jsx');
  const detail = source('../sections/landlord/leases/LeaseDetailView.jsx');
  const routes = source('../routes/MainRoutes.jsx');
  assert.match(lease, /leaseChecklists\?\.find\(\(item\) => String\(item\.leaseId/);
  assert.match(lease, /navigate\(buildChecklistWorkspacePath\(existing\)\)/);
  assert.match(lease, /navigate\(`\/landlord\/leases\/\$\{leaseId\}\/checklists\/\$\{type\}\/new\?\$\{params\}`/);
  assert.match(detail, /onClick=\{cardAction\}/);
  assert.match(detail, /onViewChecklists\('move-in'\)/);
  assert.match(routes, /path: 'landlord\/leases\/:leaseId\/checklists\/:createType\/new'/);
});

test('standalone creation reuses the drawer fields and validates the lease context without breadcrumbs', () => {
  const page = source('../pages/landlord/checklists.jsx');
  assert.match(page, /const CreationContainer = standalone \? Box : ThemeAdaptiveDrawer/);
  assert.match(page, /\{!standalone && \([\s\S]*<PageBreadcrumbs/);
  assert.match(page, /getChecklistLeaseOptions|checklist-options/);
  assert.match(page, /contextLease = standalone \? leases\.find/);
  assert.match(page, /setSelectedProperty\(propertyOptions\.find/);
  assert.match(page, /setSelectedUnit\(matchingUnit\)/);
  assert.match(page, /setSelectedLeaseId\(contextLease\.id\)/);
  assert.match(page, /disabled=\{standalone\}/);
  assert.match(page, /How many floors/);
  assert.match(page, /Room names/);
  assert.match(page, /const existingResponse = await getChecklistsByLease\(selectedLeaseId\)/);
  assert.match(page, /LeaseId: leaseDecision === 'linked' \? selectedLeaseId : null/);
});
