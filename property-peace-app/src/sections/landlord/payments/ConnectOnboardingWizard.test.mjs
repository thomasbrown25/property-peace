import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const wizardSource = await readFile(new URL('./ConnectOnboardingWizard.jsx', import.meta.url), 'utf8');
const settingsSource = await readFile(new URL('../settings/PaymentsSettings.jsx', import.meta.url), 'utf8');

test('online-payment setup offers individual and business recipient types', () => {
  assert.match(wizardSource, /New bank account/);
  assert.match(wizardSource, /Individuals and sole proprietorships/);
  assert.match(wizardSource, /Companies, LLCs, and partnerships/);
});

test('business setup collects legal business identity', () => {
  assert.match(wizardSource, /<FormInput\b[^>]*label="Legal Business Name \*"/);
  assert.match(wizardSource, /<InputLabel htmlFor=\{einInputId\}>EIN \*<\/InputLabel>\s*<TextField\s+id=\{einInputId\}/);
  assert.match(wizardSource, /ein\.replace\(\/\\D\/g, ''\)/);
});

test('the individual display name uses the shared field with an example placeholder', () => {
  assert.match(wizardSource, /<FormInput\b[^>]*label="Landlord display name \*"\s+placeholder="ex\. John Doe"/);
});

test('Next stays disabled until the current step passes validation', () => {
  assert.match(wizardSource, /validateConnectOnboardingStep\(activeStep, draft, ein\)/);
  assert.match(wizardSource, /Object\.keys\(nextErrors\)\.length > 0/);
  assert.match(wizardSource, /onClick=\{handleNext\} disabled=\{nextDisabled\}/);
});

test('Select all changes the property scope and requires authority to be confirmed again', () => {
  assert.match(wizardSource, /onClick=\{\(\) => updatePropertySelection\(properties\.map\(getPropertyId\)\)\}[\s\S]*?Select all/);
  assert.match(wizardSource, /const updatePropertySelection = \(propertyIds\) => \{\s*setDraft\(\(current\) => \(\{ \.\.\.current, propertyIds, authorityAttested: false \}\)\)/);
});

test('account type selection and setup actions use the theme primary color', () => {
  assert.match(wizardSource, /control=\{<Radio color="primary" \/>\}/);
  assert.match(wizardSource, /borderColor: selected \? 'primary.main' : 'divider'/);
  assert.match(wizardSource, /palette\.primary\.main, 0\.06/);
  assert.match(wizardSource, /color="primary" onClick=\{handleNext\}/);
  assert.match(wizardSource, /color="primary" onClick=\{handleContinue\}/);
});

test('EIN bypasses persisted preparation and is sent only to account creation', () => {
  assert.match(settingsSource, /const \{ ein, \.\.\.preparationContext \} = context/);
  assert.match(settingsSource, /connect-preparation', preparationContext/);
  assert.match(settingsSource, /legalBusinessName: preparationContext\.operatingType === 'business'/);
  assert.match(settingsSource, /\r?\n\s+ein\r?\n/);
});
