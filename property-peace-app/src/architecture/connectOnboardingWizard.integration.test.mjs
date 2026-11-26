import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('bank account setup starts with the Property Peace preparation wizard before creating a Stripe account', async () => {
  const settings = await read('../sections/landlord/settings/PaymentsSettings.jsx');

  assert.match(settings, /import ConnectOnboardingWizard from 'sections\/landlord\/payments\/ConnectOnboardingWizard'/);
  assert.match(settings, /<ConnectOnboardingWizard\s+embedded/);
  assert.match(settings, /onContinue=\{handlePreparedConnectAccount\}/);
  assert.match(settings, /onClick=\{stripeAction\}/);
  assert.match(settings, /get\('\/api\/stripe\/connect-preparation', \{ signal \}\)/);
  assert.match(settings, /post\('\/api\/stripe\/connect-preparation'/);
  assert.match(settings, /initialDraft=\{preparation\.data\}/);
  assert.match(settings, /window\.location\.assign\(onboardingUrl\)/);
});

test('Review in Stripe opens a fresh hosted link for the owned account’s outstanding requirements', async () => {
  const settings = await read('../sections/landlord/settings/PaymentsSettings.jsx');

  assert.match(settings, /const needsHostedOnboarding = stripeStatus\.setupRequired \|\| accountStatus\.HasPastDueRequirements/);
  assert.match(settings, /const stripeAction = !hasStripeAccount \? openStripeSetup : needsHostedOnboarding \? openStripeHostedOnboarding : openStripeDashboard/);
  assert.match(settings, /post\('\/api\/stripe\/account-link', \{ type: 'account_onboarding' \}, \{ signal \}\)/);
  assert.match(settings, /onClick=\{stripeAction\}[\s\S]{0,250}stripeActionLabel/);
});

test('embedded setup shows step progress and keeps the dialog wrapper for other entry points', async () => {
  const wizard = await read('../sections/landlord/payments/ConnectOnboardingWizard.jsx');
  assert.match(wizard, /if \(embedded\) \{[\s\S]*?aria-label="Stripe setup progress"[\s\S]*?aria-current=\{index === activeStep \? 'step' : undefined\}/);
  assert.match(wizard, /if \(embedded\) \{[\s\S]*?\{stepContent\}[\s\S]*?\{stepActions\}[\s\S]*?return \(\s*<Dialog/);
});

test('the Property Peace wizard clearly hands regulated data collection to Stripe', async () => {
  const wizard = await read('../sections/landlord/payments/ConnectOnboardingWizard.jsx');

  assert.match(wizard, /Stripe securely verifies the payout recipient and bank account/);
  assert.match(wizard, /Stripe secure verification may request[\s\S]*identity documents[\s\S]*a payout bank account/);
  assert.match(wizard, /Continue to Stripe/);
  assert.match(wizard, /authorityAttested/);
  assert.match(wizard, /updatePropertySelection\(\[\.\.\.selected\]\)/);
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
