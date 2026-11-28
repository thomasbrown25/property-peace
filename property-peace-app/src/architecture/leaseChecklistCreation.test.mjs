import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('lease checklist card opens a lease-scoped creation route only when no matching checklist exists', () => {
  const lease = source('../pages/landlord/lease.jsx');
  const detail = source('../sections/landlord/leases/LeaseDetailView.jsx');
  const routes = source('../routes/MainRoutes.jsx');
  const openChecklist = lease.match(/onViewChecklists=\{async\b[\s\S]*?\n\s*\}\}/)?.[0];
  assert.ok(openChecklist, 'Lease detail should receive a checklist navigation handler');
  const [lookup, creation] = openChecklist.split('const params = new URLSearchParams');
  assert.ok(creation, 'Checklist creation should pass lease property context');
  assert.match(lookup, /await listTransitionChecklists\(\{ leaseId \}\)/);
  assert.match(lookup, /if \(!Array\.isArray\(records\)\) throw/);
  assert.match(lookup, /String\(record\.leaseId\) === String\(leaseId\) && record\.phase === phase/);
  assert.match(lookup, /if \(existing\) \{\s*navigate\(`\/landlord\/checklists\/handoff\/\$\{existing\.id\}`\);\s*return;\s*\}/);
  assert.match(creation, /navigate\(`\/landlord\/checklists\?\$\{params\}`/);
  assert.match(detail, /onClick=\{cardAction\}/);
  assert.match(detail, /onViewChecklists\('move-in'\)/);
  assert.match(detail, /onViewChecklists\('move-out'\)/);
  assert.match(routes, /path: 'landlord\/leases\/:leaseId\/checklists\/:createType\/new'/);
  assert.match(routes, /path: 'landlord\/checklists\/handoff\/:transitionId'/);
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
