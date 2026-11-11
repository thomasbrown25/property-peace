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

test('rent history tiles show month and due day above payment status', () => {
  const tiles = between('{paymentTimeline.map((cycle, index) => {', '</SectionCard>');
  assert.match(tiles, /\{cycle\.label\} \{Number\(cycle\.dueDate\.slice\(8\)\)\}/);
  assert.match(tiles, /cycle\.status === 'on-time' \? 'On-time' : cycle\.status === 'late' \? 'Late' : cycle\.status === 'overdue' \? 'Overdue' : 'Upcoming'/);
  assert.doesNotMatch(tiles, /cycle\.dueDate\.slice\(2, 4\)|`Due \$\{/);
  assert.match(tiles, /aria-label=\{/);
});

test('payment history stays visually blank while loading and preserves errors and retry', () => {
  const loading = between('{paymentsLoading ? (', ') : paymentsError ? (');
  assert.match(loading, /<Box role="status" aria-busy="true" aria-label="Loading payment history" sx=\{\{ minHeight: 126 \}\} \/>/);
  assert.doesNotMatch(loading, /CircularProgress|Typography|bgcolor/);
  const error = between(') : paymentsError ? (', ') : paymentTimeline.length ? (');
  assert.match(error, /role="alert"/);
  assert.match(error, /onClick=\{onRetryPayments\}/);
});

test('payment tiles keep slide-in animation while checklist cards remain static', () => {
  const animation = between('const cardDealAnimationSx = {', 'function LeaseMoveInCard(');
  assert.match(animation, /translateX\(-28px\) rotate\(-4deg\) scale\(0\.96\)/);
  assert.match(animation, /dealRentCard 420ms cubic-bezier\(0\.22, 1, 0\.36, 1\) both/);
  assert.match(animation, /prefers-reduced-motion: reduce/);
  assert.match(animation, /animation: 'none'/);
  const checklist = between('function LeaseMoveInCard(', '// ─── Section card');
  const history = between('<SectionCard title="Rent payment history">', '</SectionCard>');
  assert.match(history, /\.\.\.cardDealAnimationSx/);
  assert.match(history, /'--deal-delay': `\$\{Math\.min\(index \* 55, 660\)\}ms`/);
  assert.doesNotMatch(checklist, /cardDealAnimationSx|--deal-delay|dealRentCard/);
  assert.match(checklist, /\.map\(\(step\) =>/);
  assert.match(checklist, /role=\{cardAction \? 'button' : undefined\}/);
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
