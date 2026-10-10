import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const detail = fs.readFileSync(new URL('../pages/landlord/inspection-detail.jsx', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../routes/MainRoutes.jsx', import.meta.url), 'utf8');
const lease = fs.readFileSync(new URL('../pages/landlord/lease.jsx', import.meta.url), 'utf8');
const calendar = fs.readFileSync(new URL('../pages/landlord/calendar.jsx', import.meta.url), 'utf8');
const drawer = fs.readFileSync(new URL('../components/drawers/ScheduleInspectionDrawer.jsx', import.meta.url), 'utf8');

test('property overview routes redirect to the checklists table, while detail routes remain', () => {
  for (const route of ['landlord/checklists/property/:propertyId', 'landlord/checklists/property/:propertyId/unit/:unitId']) {
    const block = routes.slice(routes.indexOf(`path: '${route}'`), routes.indexOf('},', routes.indexOf(`path: '${route}'`)));
    assert.match(block, /<Navigate to="\/landlord\/checklists" replace \/>/);
  }
  assert.match(routes, /path: 'landlord\/checklists\/property\/:propertyId\/checklist\/:checklistId'/);
});

test('checklist detail breadcrumb points directly to the table, without property history crumb', () => {
  const crumbs = detail.match(/<PageBreadcrumbs[\s\S]*?\/>/)?.[0];
  assert.ok(crumbs);
  assert.doesNotMatch(crumbs, /overviewPath/);
  assert.doesNotMatch(crumbs, /breadcrumbLabel/);
  assert.match(crumbs, /label: 'Checklists'/);
  assert.doesNotMatch(detail, /Property condition history|<ConditionCycleCard/);
  assert.match(detail, /navigate\('\/landlord\/checklists'\)/);
});

test('old entry points go to the table, not the retired overview', () => {
  assert.doesNotMatch(lease, /navigate\(propertyId\s*\? `\/landlord\/checklists\/property/);
  assert.doesNotMatch(calendar, /: `\$\{checklistBase\}\?type=/);
  assert.doesNotMatch(drawer, /navigate\(propertyId \? `\/landlord\/checklists\/property/);
});
