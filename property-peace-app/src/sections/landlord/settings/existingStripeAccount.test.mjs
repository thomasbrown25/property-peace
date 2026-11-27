import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getTrustedStripeAuthorizationUrl } from './stripeExistingAccountUrl.mjs';

test('only accepts an HTTPS Stripe Connect authorization URL', () => {
  assert.equal(
    getTrustedStripeAuthorizationUrl('https://connect.stripe.com/oauth/authorize?client_id=ca_test'),
    'https://connect.stripe.com/oauth/authorize?client_id=ca_test'
  );
  assert.equal(getTrustedStripeAuthorizationUrl('http://connect.stripe.com/oauth/authorize'), null);
  assert.equal(getTrustedStripeAuthorizationUrl('https://connect.stripe.com.evil.example/oauth/authorize'), null);
  assert.equal(getTrustedStripeAuthorizationUrl('https://stripe.com@connect.stripe.com/oauth/authorize'), null);
});

test('existing Stripe linking saves preparation, completes a verified callback, and exposes both setup entry points', async () => {
  const settings = await readFile(new URL('./PaymentsSettings.jsx', import.meta.url), 'utf8');
  const panel = await readFile(new URL('./OnlinePaymentSettings.jsx', import.meta.url), 'utf8');

  assert.match(settings, /post\('\/api\/stripe\/existing-account\/authorize'/);
  assert.match(settings, /post\('\/api\/stripe\/existing-account\/complete', \{ code, state, error \}/);
  assert.match(settings, /stripeReturn === 'existing-return'/);
  assert.match(settings, /getTrustedStripeAuthorizationUrl/);
  assert.match(settings, /Connect existing Stripe account/);
  assert.match(panel, /setupMode/);
});

test('the OAuth callback is scrubbed before analytics starts', async () => {
  const index = await readFile(new URL('../../../../index.html', import.meta.url), 'utf8');

  assert.match(index, /isExistingStripeReturn/);
  assert.match(index, /window\.__propertyPeaceExistingStripeReturn/);
  assert.match(index, /\['stripe', 'code', 'state', 'error'\]/);
  assert.match(index, /\|\| isExistingStripeReturn\) return/);
});
