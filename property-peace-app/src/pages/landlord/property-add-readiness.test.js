import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

const propertyAddPath = './property-add.jsx';
const propertyAddWorkflowPath = './property-add-workflow.jsx';

for (const [name, path, accountField] of [
  ['property add', propertyAddPath, 'operatingAccountId'],
  ['property add workflow', propertyAddWorkflowPath, 'bankAccountId']
]) {
  test(`${name} fails closed for bank and Stripe onboarding`, async () => {
    const text = await source(path);

    assert.match(text, /canInvoke: rentCanInvoke[\s\S]*useFeatureReadiness\(FEATURE_KEYS\.onlineRentCollection\)/);
    assert.match(text, /if \(!rentCanInvoke\) \{[\s\S]*setBankAccounts\(\[\]\);[\s\S]*setShowStripeOnboarding\(false\);[\s\S]*setLoadingBankAccounts\(false\);[\s\S]*return;/);
    assert.match(text, /if \(!rentCanInvoke\) return;[\s\S]*sync-bank-account/);
    assert.match(text, new RegExp(`operatingAccountId: rentCanInvoke \\? values\\.${accountField} \\|\\| null : null`));
    assert.match(text, /\{rentCanInvoke && \([\s\S]*StripeConnectOnboardingDialog/);
  });
}

test('property add reports readiness and hides all bank selection and onboarding controls while blocked', async () => {
  const text = await source(propertyAddPath);

  assert.match(text, /FeatureReadinessNotice[\s\S]*Online rent collection/);
  assert.match(text, /\{rentCanInvoke && \([\s\S]*What is this property's primary bank account\?[\s\S]*Add new bank account/);
  assert.match(text, /if \(!rentCanInvoke\) return;\s*setShowStripeOnboarding\(true\);/);
});
