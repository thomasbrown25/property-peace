import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('property breadcrumbs and Actions share a row above equal-height hero and rent cards', async () => {
  const header = await read('./PropertyHeader.jsx');
  const actions = await read('./PropertyActions.jsx');
  const page = await read('../../../pages/landlord/property.jsx');
  assert.match(page, /<Stack direction="row" alignItems="center" justifyContent="space-between"[^>]*>[\s\S]*?<PageBreadcrumbs[\s\S]*?<PropertyActions[\s\S]*?<\/Stack>[\s\S]*?<PropertyHeader/);
  assert.doesNotMatch(header, /ThunderboltOutlined|property-actions-drawer/);
  assert.match(actions, /<ActionsDrawer id="property-actions-drawer"/);
  assert.match(header, /<Grid container spacing=\{2\} alignItems="stretch">/);
  assert.match(header, /<Grid size=\{\{ xs: 12, md: 7 \}\} sx=\{\{ display: 'flex' \}\}>/);
  assert.match(header, /width: '100%',\s*height: '100%',\s*minHeight: 300/);
  assert.match(header, /height: '100%', minHeight: 300, boxSizing: 'border-box'/);
});

test('property Actions shows all seven options with icons and descriptions in a right-side drawer', async () => {
  const source = await read('./PropertyActions.jsx');
  const drawer = await read('../../../components/drawers/shared/ActionsDrawer.jsx');
  const overview = await read('./PropertyOverview.jsx');
  assert.doesNotMatch(overview, /PropertyQuickActionsPanel/);
  assert.match(drawer, /<ThemeAdaptiveDrawer\s+anchor="right"\s+open=\{actionsOpen\}\s+onClose=\{closeActions\}/);
  assert.match(drawer, /<IconButton aria-label=\{`Close \$\{title\.toLowerCase\(\)\}`\} onClick=\{closeActions\}/);
  assert.deepEqual([...source.matchAll(/label: '([^']+)',\s+description: '[^']+',\s+icon: '(\w+)',/g)].map(([, label, icon]) => [icon, label]), [
    ['edit', 'Edit property'],
    ['leaseAdd', 'Create a lease'],
    ['leases', 'View leases'],
    ['dollarCircle', 'Record a payment'],
    ['maintenance', 'Create a maintenance ticket'],
    ['uploadDocument', 'Upload a document'],
    ['trash', 'Delete property']
  ]);
  assert.match(drawer, /<AppIcon name=\{icon\} \/>[\s\S]*?\{label\}[\s\S]*?\{description\}/);
  assert.match(drawer, /onClick=\{closeActions\}>\s*<AppIcon name="close"/);
  assert.match(drawer, /\{destructive && <Divider[\s\S]*?destructive \? 'error.main'/);
  assert.match(source, /label: 'Delete property',[\s\S]*?destructive: true,\s+onSelect: \(\) => onDelete\?\.\(\)/);
  assert.match(drawer, /transition: \{ onExited: runSelectedAction \}/);
  const page = await read('../../../pages/landlord/property.jsx');
  assert.match(source, /label: 'View leases',[^}]*onSelect: onViewLeases/);
  assert.match(page, /<PropertyActions[^>]*onViewLeases=\{\(\) => handleTabChange\('leases'\)\}/);
  assert.match(source, /label: 'Upload a document',[^}]*onSelect: onUploadDocument/);
  assert.match(page, /onUploadDocument=\{openDocumentUpload\}/);
  assert.match(page, /<PropertyDocumentUploadDrawer\s+key=\{propertyId\}\s+propertyId=\{propertyId\}\s+open=\{documentUploadPropertyId === propertyId\}/);
  assert.match(page, /onTabChange=\{handleTabChange\}/);
  assert.match(page, /onDelete=\{\(\) => setDeletePropertyModalOpen\(true\)\}/);
  assert.match(page, /<DeletePropertyModal\s+open=\{deletePropertyModalOpen\}/);
});

test('property Actions matches the payment button using theme-contained styling', async () => {
  const actions = await read('../../../components/drawers/shared/ActionsDrawer.jsx');
  const header = await read('./PropertyHeader.jsx');
  const buttonStyle = actions.match(/const actionButtonSx = \{([\s\S]*?)\n\};/)?.[1];
  assert.ok(buttonStyle, 'property Actions button style exists');
  assert.match(actions, /<Button\s+variant="contained"\s+startIcon=\{<AppIcon name="flash" variant="bold" \/>\}/);
  assert.match(header, /<Button\s+variant="contained"\s+startIcon=\{<AppIcon name="dollarCircle" \/>\}/);
  assert.match(header, /<AppIcon name="moneys" size=\{26\} \/>[\s\S]*?Due amount/);
  assert.match(buttonStyle, /textTransform: 'none'/);
  assert.doesNotMatch(buttonStyle, /borderColor|bgcolor|background|color:|fontWeight|&:hover|&:focus-visible/);
  assert.match(actions, /aria-expanded=\{actionsOpen\}[\s\S]*?sx=\{actionButtonSx\}[\s\S]*?>\s*Actions/);
});

test('the rent card shows setup only and the Actions drawer shares the state-dependent action', async () => {
  const [header, actions, page] = await Promise.all([
    read('./PropertyHeader.jsx'), read('./PropertyActions.jsx'), read('../../../pages/landlord/property.jsx')
  ]);
  assert.match(header, /<Stack direction="row"[^>]*flexWrap="wrap"[^>]*>[\s\S]*?Record a payment[\s\S]*?onlinePaymentAction\?\.showInRentCard &&[\s\S]*?onClick=\{onlinePaymentAction\.onSelect\}[\s\S]*?\{onlinePaymentAction\.label\}/);
  assert.match(actions, /\.\.\.\(onlinePaymentAction \? \[onlinePaymentAction\] : \[\]\)/);
  assert.match(page, /propertyMatchesRoute && propertyMatchesOrganization && collectsRentOnline\(selectedProperty\)\s*\? \['\/api\/stripe\/account-status', userId, organizationId\]/);
  assert.match(page, /'X-Organization-Id': String\(scopedOrganizationId\)/);
  assert.match(page, /<PropertyActions[^>]*onlinePaymentAction=\{onlinePaymentAction\}/);
  assert.match(page, /<PropertyHeader[^>]*onlinePaymentAction=\{onlinePaymentAction\}/);
});

test('online payment actions depend on an opted-in long-term lease and confirmed Stripe setup status', async () => {
  const { collectsRentOnline, getOnlinePaymentAction } = await import('./propertyOnlinePayments.mjs');
  assert.equal(collectsRentOnline({ units: [{ lease: { rentCollectionByPlatform: true } }] }), true);
  assert.equal(collectsRentOnline({ Units: [{ Lease: { RentCollectionByPlatform: true } }] }), true);
  assert.equal(collectsRentOnline({ units: [{ lease: { rentCollectionByPlatform: false } }] }), false);
  assert.equal(collectsRentOnline({ units: [{ lease: { rentCollectionByPlatform: true, isActive: false } }] }), false);
  assert.equal(collectsRentOnline({ units: [{ rentalMode: 'shortTerm', lease: { rentCollectionByPlatform: true } }] }), false);
  assert.equal(collectsRentOnline({ units: [{}] }), false);

  for (const response of [{ detailsSubmitted: false }, { success: true, data: { detailsSubmitted: false } }]) {
    const setup = getOnlinePaymentAction(response);
    assert.equal(setup.label, 'Setup online payments');
    assert.equal(setup.showInRentCard, true);
  }
  const edit = getOnlinePaymentAction({ success: true, data: { detailsSubmitted: true } });
  assert.equal(edit.label, 'Edit online payment settings');
  assert.equal(edit.showInRentCard, false);
  assert.equal(getOnlinePaymentAction(), null);
  assert.equal(getOnlinePaymentAction({ success: false, data: { detailsSubmitted: false } }), null);
});

test('overview shows property activity without rent due, units at a glance, or tenant and lease cards', async () => {
  const overview = await read('./PropertyOverview.jsx');
  assert.doesNotMatch(overview, /<PropertyCurrentTenant|<PropertyActiveLease/);
  assert.doesNotMatch(overview, /<PropertyMonthlyRent|<PropertyUnitsAtAGlance/);
  assert.match(overview, /<PropertyStory/);
});
