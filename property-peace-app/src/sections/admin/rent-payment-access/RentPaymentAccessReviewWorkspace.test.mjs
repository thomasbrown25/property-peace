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
});
