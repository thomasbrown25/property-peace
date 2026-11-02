import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../sections/landlord/leases/LeaseDetailView.jsx', import.meta.url),
  'utf8'
);

const between = (start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
};

test('the six requested workspace tabs render in order', () => {
  const tabBlock = between('aria-label="Lease detail sections"', '</Tabs>');
  const labels = ['Overview', 'Tenants', 'Payments', 'Documents', 'Insurance', 'Utilities'];
  let previous = -1;
  labels.forEach((label) => {
    const index = tabBlock.indexOf(`label="${label}"`);
    assert.ok(index > previous, `${label} should appear in the requested order`);
    previous = index;
  });
  assert.doesNotMatch(tabBlock, /label="Agreements"/);
});

test('Overview shows full-term rent payment history above move-in readiness instead of lifecycle bars', () => {
  const tabs = source.indexOf('aria-label="Lease detail sections"');
  const overview = between('{activeTab === 0 && (', '{activeTab === 1 && (');
  const timeline = overview.indexOf('title="Rent payment history"');
  const moveIn = overview.indexOf('<LeaseMoveInCard');
  const leaseActivity = overview.indexOf('title="Lease activity"');

  assert.ok(tabs >= 0, 'lease workspace tabs should render');
  assert.ok(timeline >= 0, 'payment history should be inside Overview');
  assert.ok(moveIn > timeline, 'move-in readiness should follow the payment timeline');
  assert.ok(leaseActivity > moveIn, 'activity should follow move-in readiness');
  assert.match(overview, /paymentTimeline\.map/);
  assert.match(overview, /Not due yet/);
  assert.match(overview, /Paid on time/);
  assert.match(overview, /Paid late/);
  assert.match(overview, /Overdue/);
  assert.doesNotMatch(overview, /Lease Lifecycle|Lease Agreement Lifecycle|<LifecycleBar/);
  assert.doesNotMatch(overview, /title="Key terms"/);
  const afterMoveIn = overview.slice(moveIn);
  assert.doesNotMatch(afterMoveIn, /<Grid[^>]+size=/, 'move-in readiness should not be constrained to a grid column');
});

test('lease checklist shows only the requested steps and no setup chip', () => {
  const card = between('function LeaseMoveInCard(', '// ─── Section card');
  assert.match(card, /Lease checklist/);
  assert.doesNotMatch(card, /Setup in progress|Tracked steps complete|<Chip/);
  assert.doesNotMatch(card, /onConfigureRent|onCustomizeConditionReport|rent-deposit|condition-report/);
  assert.match(card, /sortLeaseChecklistSteps\(checklist\.steps\)\.map/);
  assert.match(card, /gridTemplateColumns: \{ xs: '1fr', sm: 'repeat\(2, minmax\(0, 1fr\)\)', lg: 'repeat\(4, minmax\(0, 1fr\)\)' \}/);
  const overview = between('{activeTab === 0 && (', '{activeTab === 1 && (');
  assert.match(overview, /checklists=\{leaseChecklists\}/);
});

test('lease header keeps the property title compact and omits tenant names from the subtitle', () => {
  const header = between('{/* ── Lease header', '{isDraftLease && (');
  assert.match(header, /fontSize: \{ xs: '1\.75rem', sm: '2\.25rem' \}/);
  assert.match(header, /modeLabel\(lease\?\.unit \?\? lease\?\.Unit\)/);
  assert.doesNotMatch(header, /tenantFullName \? `\$\{tenantFullName\}/);
});

test('lease header keeps upload in actions without a renew shortcut', () => {
  const headerActions = between('id="lease-actions-menu"', '</Menu>');
  assert.match(headerActions, />\s*Upload document\s*</);
  assert.doesNotMatch(headerActions, />\s*Renew\s*</);
});

test('tenant, payment, and document tabs expose the requested controls and sections', () => {
  const tenants = between('{activeTab === 1 && (', '{activeTab === 2 && (');
  assert.match(tenants, /<TenantsCard/);
  assert.doesNotMatch(tenants, /People on this lease|Manage tenants and co-signers|Add tenant or co-signer/);
  const tenantsList = between('function TenantsCard(', '// ─── Main Component');
  assert.doesNotMatch(tenantsList, />\s*Tenants\s*</);
  assert.match(tenantsList, /\+ Add tenant or co-signer/);

  const tenantCard = between('function TenantRow(', 'function TenantsCard(');
  assert.match(tenantCard, />\s*Message\s*</);
  assert.match(tenantCard, />\s*View profile\s*</);

  const payments = between('{activeTab === 2 && (', '{activeTab === 3 && (');
  assert.match(payments, /placeholder="Search payments"/);
  assert.match(payments, /label="From"/);
  assert.match(payments, /label="To"/);
  assert.match(payments, /filteredPayments\.map/);
  assert.doesNotMatch(payments, />\s*Record payment\s*</);

  const documents = between('{activeTab === 3 && (', '{activeTab === 4 && (');
  assert.match(documents, /<TableContainer/);
  assert.match(documents, /documentPagination\.rows\.map/);
  assert.match(documents, /Create agreement/);
  assert.match(documents, /<TablePagination/);
});
