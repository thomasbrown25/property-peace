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
  assert.match(settings, /onClick=\{hasNoAccount\s*\? openConnectPreparation\s*:\s*needsOnboarding\s*\? openStripeHostedOnboarding\s*:\s*openStripeDashboard\}/);
  assert.match(settings, /get\('\/api\/stripe\/connect-preparation', \{ signal \}\)/);
  assert.match(settings, /post\('\/api\/stripe\/connect-preparation'/);
  assert.match(settings, /initialDraft=\{connectPreparation\}/);
  assert.match(settings, /window\.location\.assign\(onboardingUrl\)/);
});

test('the Property Peace wizard clearly hands regulated data collection to Stripe', async () => {
  const wizard = await read('../sections/landlord/payments/ConnectOnboardingWizard.jsx');

  assert.match(wizard, /Stripe securely verifies the payout recipient and bank account/);
  assert.match(wizard, /Stripe secure verification may request[\s\S]*identity documents[\s\S]*a payout bank account/);
  assert.match(wizard, /Continue to Stripe/);
  assert.match(wizard, /authorityAttested/);
  assert.match(wizard, /propertyIds: \[\.\.\.selected\], authorityAttested: false/);
  assert.match(wizard, /authorityRelationship: [^,\n]+, authorityAttested: false/);
  assert.match(wizard, /selected property/i);
  assert.match(wizard, /Loading your properties/);
  assert.match(wizard, /We could not load your properties/);
});

test('Stripe session secrets are not written to the browser console', async () => {
  const settings = await read('../sections/landlord/settings/PaymentsSettings.jsx');

  assert.doesNotMatch(settings, /console\.log\('Account session response:'/);
  assert.doesNotMatch(settings, /console\.log\('Client secret retrieved:'/);
});
