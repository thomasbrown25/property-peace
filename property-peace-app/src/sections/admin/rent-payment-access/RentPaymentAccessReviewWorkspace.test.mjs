import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const workspace = () => readFile(new URL('./RentPaymentAccessReviewWorkspace.jsx', import.meta.url), 'utf8');
const routes = () => readFile(new URL('../../../routes/MainRoutes.jsx', import.meta.url), 'utf8');

test('admin routes provide a GET-only email landing path', async () => {
  const routeSource = await routes();
  assert.match(routeSource, /lazy\(\(\) => import\('pages\/admin\/rent-payment-access'\)\)/);
  assert.match(routeSource, /path: 'admin\/rent-payment-access'/);
  assert.match(routeSource, /path: 'admin\/rent-payment-access\/:publicId'/);
});

test('review workspace keeps decisions explicit and recovery-safe', async () => {
  const source = await workspace();
  assert.match(source, /getRentPaymentAccessRequest\(publicId\)/);
  assert.match(source, /approveRentPaymentAccessRequest/);
  assert.match(source, /rejectRentPaymentAccessRequest/);
  assert.match(source, /suspendRentPaymentAccessRequest/);
  assert.match(source, /unlocks payment onboarding, not tenant payments/);
  assert.match(source, /Admin-only internal notes/);
  assert.match(source, /409/);
  assert.match(source, /Refresh.*latest/);
  assert.match(source, /Pending[\s\S]*Approved[\s\S]*Rejected[\s\S]*Suspended/);
  assert.match(source, /onClick=\{\(\) => openDecision/);
  assert.match(source, /requestedBy \|\| detail\?\.RequestedBy/);
  assert.match(source, /requestedAtUtc \|\| detail\?\.RequestedAtUtc/);
  assert.match(source, /auditEvents \|\| detail\?\.AuditEvents/);
  assert.match(source, /occurredAtUtc \|\| item\.OccurredAtUtc/);
  assert.match(source, /nextStatus \|\| item\.NextStatus/);
  assert.match(source, /request\.requestedBy \|\| request\.RequestedBy/);
  assert.match(source, /connectedPayeeExists \|\| detail\?\.ConnectedPayeeExists/);
});

test('review workspace exposes only legal access transitions', async () => {
  const source = await workspace();
  assert.match(source, /Pending: \['approve', 'reject', 'suspend'\]/);
  assert.match(source, /Approved: \['suspend'\]/);
  assert.doesNotMatch(source, /status !== 'Approved'/);
  assert.doesNotMatch(source, /status !== 'Rejected'/);
  assert.doesNotMatch(source, /status !== 'Suspended'/);
});
