import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('bank account setup starts with the Property Peace preparation wizard before creating a Stripe account', async () => {
  const settings = await read('../sections/landlord/settings/PaymentsSettings.jsx');

  assert.match(settings, /import ConnectOnboardingWizard from 'sections\/landlord\/payments\/ConnectOnboardingWizard'/);
  assert.match(settings, /setShowPreparation\(true\)/);
  assert.match(settings, /<ConnectOnboardingWizard/);
  assert.match(settings, /onContinue=\{handlePreparedConnectAccount\}/);
  assert.match(settings, /hasNoAccount \? openConnectPreparation : openEmbeddedOnboarding/);
  assert.match(settings, /typeof accountId === 'string' && accountId\.trim\(\)/);
  assert.match(settings, /get\('\/api\/stripe\/connect-preparation'\)/);
  assert.match(settings, /post\('\/api\/stripe\/connect-preparation'/);
  assert.match(settings, /initialDraft=\{connectPreparation\}/);
});

test('the Property Peace wizard clearly hands regulated data collection to Stripe', async () => {
  const wizard = await read('../sections/landlord/payments/ConnectOnboardingWizard.jsx');

  assert.match(wizard, /Verify your business and set up rent payouts/);
  assert.match(wizard, /Property Peace does not collect or store your SSN, identity documents, or full bank account details/);
  assert.match(wizard, /Stripe secure verification/);
  assert.match(wizard, /authorityAttested/);
  assert.match(wizard, /propertyIds: \[\.\.\.selected\], authorityAttested: false/);
  assert.match(wizard, /authorityRelationship: event\.target\.value, authorityAttested: false/);
  assert.match(wizard, /selected property/i);
  assert.match(wizard, /Loading your properties/);
  assert.match(wizard, /We could not load your properties/);
});

test('Stripe session secrets are not written to the browser console', async () => {
  const settings = await read('../sections/landlord/settings/PaymentsSettings.jsx');

  assert.doesNotMatch(settings, /console\.log\('Account session response:'/);
  assert.doesNotMatch(settings, /console\.log\('Client secret retrieved:'/);
});
