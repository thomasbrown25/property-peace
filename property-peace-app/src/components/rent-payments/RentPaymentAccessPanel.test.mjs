import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = () => readFile(new URL('./RentPaymentAccessPanel.jsx', import.meta.url), 'utf8');

test('account panel renders setup/readiness without internal approval or request actions', async () => {
  const text = await source();
  assert.doesNotMatch(text, /canRequest|onRequest|requesting|[Aa]pprov|[Uu]nder review|not-requested/);
  assert.match(text, /Setup required/);
  assert.match(text, /Stripe setup/);
  assert.match(text, /onConfigure/);
  assert.match(text, /onRefresh/);
  assert.match(text, /aria-live="polite"/);
  assert.match(text, /disabled=\{loading\}/);
});

test('payment settings retains Stripe authorization and drops internal status fields', async () => {
  const text = await readFile(new URL('../../sections/landlord/settings/PaymentsSettings.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /InternalReviewStatus|IsInternallyPayoutApproved|Property Peace review|requestAccess/);
  assert.match(text, /canManageStripeAccount\(accountStatus\)/);
  assert.match(text, /canCreateInitialStripeAccount/);
  assert.match(text, /Stripe verification pending/);
  assert.match(text, /DetailsSubmitted/);
});
