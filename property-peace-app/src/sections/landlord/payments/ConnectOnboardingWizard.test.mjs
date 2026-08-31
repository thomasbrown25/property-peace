import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const wizardSource = await readFile(new URL('./ConnectOnboardingWizard.jsx', import.meta.url), 'utf8');
const settingsSource = await readFile(new URL('../settings/PaymentsSettings.jsx', import.meta.url), 'utf8');

test('online-payment setup offers individual and business recipient types', () => {
  assert.match(wizardSource, /New bank account/);
  assert.match(wizardSource, /Individuals and sole proprietorships/);
  assert.match(wizardSource, /Companies, LLCs, and partnerships/);
  assert.match(wizardSource, /Select an account type\./);
});

test('business setup collects and validates legal business identity', () => {
  assert.match(wizardSource, /Legal Business Name/);
  assert.match(wizardSource, /label="EIN"/);
  assert.match(wizardSource, /EIN_PATTERN\.test\(ein\)/);
  assert.match(wizardSource, /ein\.replace\(\/\\D\/g, ''\)/);
});

test('EIN bypasses persisted preparation and is sent only to account creation', () => {
  assert.match(settingsSource, /const \{ ein, \.\.\.preparationContext \} = context/);
  assert.match(settingsSource, /connect-preparation', preparationContext/);
  assert.match(settingsSource, /legalBusinessName: preparationContext\.operatingType === 'business'/);
  assert.match(settingsSource, /\r?\n\s+ein\r?\n/);
});
