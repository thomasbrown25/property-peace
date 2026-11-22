import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const propertyActions = read('../property/PropertyActions.jsx');
const leaseDetail = read('./LeaseDetailView.jsx');
const drawer = read('../../../components/drawers/shared/ActionsDrawer.jsx');

test('property and lease Actions use the same right-side drawer and filled trigger', () => {
  assert.match(propertyActions, /<ActionsDrawer id="property-actions-drawer" title="Property actions" actions=\{actions\}/);
  assert.match(leaseDetail, /<ActionsDrawer id="lease-actions-drawer" title="Lease actions"[^>]*actions=\{leaseActions\}/);
  assert.match(drawer, /<Button\s+variant="contained"\s+startIcon=\{<AppIcon name="flash" variant="bold" \/>\}/);
  assert.match(drawer, /aria-haspopup="dialog"\s+aria-controls=\{actionsOpen \? id : undefined\}/);
  assert.match(drawer, /<ThemeAdaptiveDrawer\s+anchor="right"/);
  assert.match(drawer, /<AppIcon name=\{icon\} \/>[\s\S]*?\{label\}[\s\S]*?\{description\}/);
  assert.match(drawer, /transition: \{ onExited: runSelectedAction \}/);
  assert.doesNotMatch(leaseDetail, /lease-actions-menu|leaseActionsAnchor/);
});

test('lease Actions shares the breadcrumb row above the lease summary', () => {
  assert.match(leaseDetail, /<Stack direction="row" alignItems="center" justifyContent="space-between"[^>]*>\s*<PageBreadcrumbs items=\{breadcrumbItems\} \/>\s*<ActionsDrawer id="lease-actions-drawer"[^>]*\/>\s*<\/Stack>\s*\{\/\* The home gives this lease/);
  assert.equal([...leaseDetail.matchAll(/<ActionsDrawer\b/g)].length, 1);
});

test('lease drawer lists the existing actions with descriptions and Iconsax icons', () => {
  const actions = leaseDetail.match(/const leaseActions = \[([\s\S]*?)\]\.filter\(Boolean\)/)?.[1];
  assert.ok(actions);
  assert.deepEqual([...actions.matchAll(/label: '([^']+)',\s+description: '[^']+',\s+icon: '(\w+)',/g)].map(([, label, icon]) => [label, icon]), [
    ['Edit lease', 'edit'],
    ['Record a payment', 'dollarCircle'],
    ['Upload a document', 'uploadDocument'],
    ['End lease early', 'stopCircle'],
    ['Reopen lease', 'reopen'],
    ['Delete lease', 'trash']
  ]);
  assert.match(actions, /!isDraftLease && \{\s*label: 'Upload a document'/);
  assert.match(actions, /!isDraftLease && \(lease\?\.isActive \|\| isNotStarted\) && \{\s*label: 'Record a payment'/);
  assert.match(actions, /!isDraftLease && \(lease\?\.isActive \? \{\s*label: 'End lease early'[\s\S]*?\} : \{\s*label: 'Reopen lease'/);
});
