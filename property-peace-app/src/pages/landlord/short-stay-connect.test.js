import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('./short-stay-connect.js', import.meta.url), 'utf8'))
  .replace("import axios from 'utils/axios';", 'const axios = globalThis.__connectAxios;')
  .replace("import { getInitialStripeOnboardingUrl } from 'utils/stripeOrganizationRequestLifecycle';", `const getInitialStripeOnboardingUrl = (r) => r?.success && r?.data?.accountId && r?.data?.onboardingUrl;`);
const calls = [];
let statusResponse = { accountId: null, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
globalThis.__connectAxios = {
  get: async (...args) => { calls.push(['get', ...args]); return { data: args[0].endsWith('account-status') ? statusResponse : { id: 3, propertyIds: [1], updatedAt: 'now' } }; },
  post: async (...args) => { calls.push(['post', ...args]); return { data: args[0].endsWith('connect-account') ? { success: true, data: { accountId: 'acct_test', onboardingUrl: 'https://connect.stripe.com/onboard' } } : args[0].endsWith('account-link') ? { onboardingUrl: 'https://connect.stripe.com/resume' } : { id: 3, propertyIds: [1], updatedAt: 'now' } }; }
};
const { shortStayConnectAPI: api, connectReadiness, connectStatusFromResponse } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('owned-account status handles direct empty DTO and wrapped existing status, never infers card capability from charges', async () => {
  assert.equal((await api.status()).accountId, null);
  statusResponse = { success: true, data: { accountId: 'acct_existing', chargesEnabled: true, payoutsEnabled: false, cardPaymentsCapabilityStatus: 'pending', detailsSubmitted: true } };
  const result = await api.status();
  assert.deepEqual(connectReadiness(result), { charges: 'Enabled', payouts: 'Not enabled', card: 'pending', kyc: 'Details submitted' });
  assert.equal(connectReadiness({ chargesEnabled: true, payoutsEnabled: true }).card, 'Unavailable');
  assert.throws(() => connectStatusFromResponse({ data: { success: false, message: 'Denied' } }), /Denied/);
  assert.equal(calls[0][2].headers['Cache-Control'], 'no-store');
});

test('new account saves scoped preparation before creation without credentials or account ID; existing account uses owned account-link', async () => {
  calls.length = 0;
  const url = await api.create({ propertyIds: [1], operatingType: 'business', displayName: 'Owner LLC', ein: '123456789', authorityAttested: true });
  assert.equal(url, 'https://connect.stripe.com/onboard');
  assert.deepEqual(calls.map(([method, path]) => [method, path]), [['post', '/api/stripe/connect-preparation'], ['post', '/api/stripe/connect-account']]);
  assert.deepEqual(calls[1][2], { operatingType: 'business', legalBusinessName: 'Owner LLC', ein: '123456789' });
  assert.equal('ein' in calls[0][2], false);
  assert.equal('accountId' in calls[1][2], false);
  assert.equal(await api.onboard(), 'https://connect.stripe.com/resume');
  assert.deepEqual(calls[2][2], { type: 'account_onboarding' });
});

test('short stay setup shows independent Connect card before optional collection application', async () => {
  const page = await readFile(new URL('./short-stay-setup.jsx', import.meta.url), 'utf8');
  const card = await readFile(new URL('./short-stay-connect.jsx', import.meta.url), 'utf8');
  const prep = await readFile(new URL('../../../../property-peace-api/Controllers/StripeConnectPreparationController.cs', import.meta.url), 'utf8');
  const settings = await readFile(new URL('../../sections/landlord/settings/PaymentsSettings.jsx', import.meta.url), 'utf8');
  assert.ok(page.indexOf('<ShortStayConnect propertyId={propertyId} />') < page.indexOf('<ShortStayCollection propertyId={propertyId} />'));
  assert.match(card, /status\.accountId && <Button/);
  assert.match(card, /!status\.accountId && <Button/);
  assert.match(card, /Card payments capability: \{readiness.card\}/);
  assert.doesNotMatch(card, /rentCanInvoke|rentPaymentAccess|collectionStatus|identityEnabled/);
  assert.match(prep, /\[RequireStripeConnectSetupReady\]/);
  assert.doesNotMatch(prep, /RequireRentPaymentActionReady/);
  assert.match(settings, /<ShortStayConnect \/>/);
  assert.ok(settings.indexOf('<ShortStayConnect />') < settings.indexOf('<PaymentsSettingsContent rentPaymentAccess={rentPaymentAccess} />'));
});
