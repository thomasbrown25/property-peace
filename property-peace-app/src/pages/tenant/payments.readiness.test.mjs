import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const tenantPage = () => readFile(new URL('./payments.jsx', import.meta.url), 'utf8');
const modal = () => readFile(new URL('../../components/drawers/PaymentModal.jsx', import.meta.url), 'utf8');
const dashboard = () => readFile(new URL('./dashboard.jsx', import.meta.url), 'utf8');
const hook = () => readFile(new URL('../../hooks/useRentPaymentActionReadiness.js', import.meta.url), 'utf8');

test('tenant payment entry points use the action-specific Pay readiness gate', async () => {
  const source = await tenantPage();
  assert.match(source, /useRentPaymentActionReadiness\('Pay'\)/);
  assert.match(source, /if \(!canInvoke\) return/);
  assert.match(source, /disabled=\{!canInvoke\}/);
  assert.match(source, /\{canInvoke && \(\s*<PaymentModal/s);
  assert.match(source, /Payment History/);
  assert.doesNotMatch(source, /useFeatureReadiness\(FEATURE_KEYS\.onlineRentCollection\)/);
});

test('tenant dashboard payment and payment-method actions use Pay readiness', async () => {
  const source = await dashboard();
  assert.match(source, /useRentPaymentActionReadiness\('Pay'\)/);
  assert.match(source, /disabled=\{!canInvoke \|\| !paymentAllocation/);
  assert.match(source, /\{canInvoke && paymentMethodModalOpen/);
  assert.match(source, /\{canInvoke && lease && \(\s*<PaymentModal/s);
});
test('tenant payment modal independently fails closed before loading Stripe', async () => {
  const source = await modal();
  assert.match(source, /useRentPaymentActionReadiness\('Pay'/);
  assert.match(source, /if \(open && !isLandlord && !canInvoke/);
  assert.match(source, /if \(!open \|\| !canInvoke\) return/);
  assert.match(source, /Online rent payments are not available right now/);
  assert.match(source, /status === 403 \|\| status === 409/);
});

test('Pay readiness hook calls the authenticated action endpoint and fails closed', async () => {
  const source = await hook();
  assert.match(source, /getRentPaymentActionReadiness\(action\)/);
  assert.match(source, /readiness\?\.allowed === true/);
  assert.match(source, /Availability could not be verified/);
  assert.match(source, /canInvoke: false/);
});
