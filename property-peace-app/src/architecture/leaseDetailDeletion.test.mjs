import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../sections/landlord/leases/LeaseDetailView.jsx', import.meta.url), 'utf8');
const section = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `expected ${start} before ${end}`);
  return source.slice(from, to);
};

test('lease Actions drawer opens the existing delete confirmation', () => {
  const actions = section('const leaseActions = [', '].filter(Boolean)');
  const openConfirmation = section('const openDeleteLease = () => {', 'const leaseActions = [');
  assert.match(source, /<ActionsDrawer id="lease-actions-drawer"[^>]*actions=\{leaseActions\}/);
  assert.match(actions, /label: 'Delete lease',[^}]*destructive: true,\s*onSelect: openDeleteLease\b/);
  assert.match(openConfirmation, /setDeleteLeaseOpen\(true\)/);
  assert.match(source, /<Dialog open=\{deleteLeaseOpen\}/);
});

test('confirmation defaults related data to selected and permits independent toggling', () => {
  assert.match(source, /\[deleteDocuments, setDeleteDocuments\] = useState\(true\)/);
  assert.match(source, /\[deleteChecklists, setDeleteChecklists\] = useState\(true\)/);
  assert.match(source, /const openDeleteLease = \(\) => \{\s*setDeleteDocuments\(true\);\s*setDeleteChecklists\(true\)/);
  const dialog = section('<Dialog open={deleteLeaseOpen}', 'anchorEl={paymentActionsAnchor}');
  assert.match(dialog, /checked={deleteDocuments} onChange={\(event\) => setDeleteDocuments\(event.target.checked\)}/);
  assert.match(dialog, /checked={deleteChecklists} onChange={\(event\) => setDeleteChecklists\(event.target.checked\)}/);
  assert.match(dialog, /archives and hides the lease/);
  assert.match(dialog, /financial records are retained, and tenant profiles are retained/);
  assert.match(dialog, /Warning: \{deleteDocuments/);
  assert.match(dialog, /Selected lease documents will be hidden \(their records and stored file blobs are retained\)/);
  assert.match(dialog, /Selected lease checklists and their items will be permanently deleted\. This cannot be undone/);
  assert.match(dialog, /Checklist photo blobs may be retained/);
  assert.doesNotMatch(dialog, /delete payments|payments will be deleted/i);
});

test('confirmation sends exactly the supported flags as DELETE query parameters and guards failures', () => {
  const handler = section('const confirmDeleteLease = async () => {', 'const handlePaymentActionsClick');
  assert.match(handler, /axios\.delete\(`\/api\/Lease\/\$\{id\}`, \{\s*params: \{ deleteLeaseDocuments: deleteDocuments, deleteChecklists \}/);
  assert.match(handler, /response\.data\?\.success === false/);
  assert.match(handler, /setDeletingLease\(true\)/);
  assert.match(handler, /try \{ await propertiesRefetch\?\.\(\); \} catch/);
  assert.match(handler, /navigate\('\/landlord\/leases'\)/);
  assert.match(handler, /catch \(error\)/);
});
