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

test('dashboard Make Payment explains why it is disabled and leaves enabled payments without a tooltip', async () => {
  const source = await dashboard();
  const reasonFunction = source.match(/^function getMakePaymentDisabledReason\([\s\S]*?^\}/m)?.[0];
  assert.ok(reasonFunction, 'Make Payment needs a reason for each disabled state');
  const getReason = new Function(`${reasonFunction}\nreturn getMakePaymentDisabledReason;`)();
  const ready = { canInvoke: true };
  const unavailable = { canInvoke: false, presentation: { message: 'Online payments are unavailable.' } };

  assert.equal(getReason({ ...unavailable, readiness: { blockers: ['connected_payee_missing'] } }, { totalAmountDue: 50 }),
    'Your landlord hasn’t enabled online payments yet.');
  assert.equal(getReason(unavailable, { totalAmountDue: 50 }), 'Online payments are unavailable.');
  assert.equal(getReason(ready, null), 'Your rent balance is unavailable right now.');
  assert.equal(getReason(ready, { totalAmountDue: 0 }), 'There’s no rent balance due.');
  assert.equal(getReason(ready, { totalAmountDue: 50 }), '');
  assert.match(source, /<Tooltip title=\{paymentDisabledReason\} describeChild>\s*<Box[\s\S]*?tabIndex=\{paymentDisabledReason \? 0 : undefined\}[\s\S]*?disabled=\{!canInvoke \|\| !paymentAllocation \|\| totalAmountDue <= 0\}[\s\S]*?Make Payment\s*<\/Button>/);
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
