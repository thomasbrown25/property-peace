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

test('Overview starts with the lifecycle row directly above full-width move-in readiness', () => {
  const tabs = source.indexOf('aria-label="Lease detail sections"');
  const overview = between('{activeTab === 0 && (', '{activeTab === 1 && (');
  const leaseLifecycle = overview.indexOf('title="Lease Lifecycle"');
  const agreementLifecycle = overview.indexOf('title="Lease Agreement Lifecycle"');
  const moveIn = overview.indexOf('<LeaseMoveInCard');
  const leaseActivity = overview.indexOf('title="Lease activity"');

  assert.ok(tabs >= 0, 'lease workspace tabs should render');
  assert.ok(leaseLifecycle >= 0, 'lease lifecycle should be inside Overview');
  assert.ok(agreementLifecycle > leaseLifecycle, 'agreement lifecycle should follow lease lifecycle');
  assert.ok(moveIn > agreementLifecycle, 'move-in readiness should sit directly below the lifecycle row');
  assert.ok(leaseActivity > moveIn, 'move-in readiness should be the first Overview component after the lifecycle row');
  assert.doesNotMatch(overview, /title="Key terms"/);
  const afterMoveIn = overview.slice(moveIn);
  assert.doesNotMatch(afterMoveIn, /<Grid[^>]+size=/, 'move-in readiness should not be constrained to a grid column');

  for (const removedTitle of ['Payment heartbeat', 'Documents', 'This lease, in money', 'Lease actions', 'Lease health']) {
    assert.doesNotMatch(overview, new RegExp(removedTitle, 'i'));
  }
});

test('lease header keeps the property title compact and omits tenant names from the subtitle', () => {
  const header = between('{/* ── Lease header', '{isDraftLease && (');
  assert.match(header, /fontSize: \{ xs: '1\.75rem', sm: '2\.25rem' \}/);
  assert.match(header, /: 'Residential lease'/);
  assert.doesNotMatch(header, /tenantFullName \? `\$\{tenantFullName\}/);
});

test('lease header exposes upload without a renew shortcut', () => {
  const headerActions = between('sx={{ flexShrink: 0, pl:', '<Menu anchorEl={actionsAnchor}');
  assert.match(headerActions, />\s*Upload document\s*</);
  assert.doesNotMatch(headerActions, />\s*Renew\s*</);
});

test('tenant, payment, and document tabs expose the requested controls and sections', () => {
  const tenants = between('{activeTab === 1 && (', '{activeTab === 2 && (');
  assert.match(tenants, /Add tenant or co-signer/);
  assert.match(tenants, /<TenantsCard/);

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
  const leaseAgreements = documents.indexOf('title="Lease agreements"');
  const forms = documents.indexOf('title="Forms"');
  const other = documents.indexOf('title="Other"');
  assert.ok(leaseAgreements >= 0, 'Documents should keep the Lease agreements card');
  assert.ok(forms > leaseAgreements, 'Forms should render below Lease agreements');
  assert.ok(other > forms, 'Other should render below Forms');
  assert.match(documents, /agreementDocuments\.map/);
  assert.match(documents, /formDocuments\.map/);
  assert.match(documents, /otherDocuments\.map/);
});
