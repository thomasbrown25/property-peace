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
    assert.match(text, name === 'property add workflow'
      ? /operatingAccountId: values\.rentalMode === 'longTerm' && rentCanInvoke \? values\.bankAccountId \|\| null : null/
      : new RegExp(`operatingAccountId: rentCanInvoke \\? values\\.${accountField} \\|\\| null : null`));
    assert.match(text, /\{rentCanInvoke && \([\s\S]*StripeConnectOnboardingDialog/);
  });
}

test('property add reports readiness and hides all bank selection and onboarding controls while blocked', async () => {
  const text = await source(propertyAddPath);

  assert.match(text, /FeatureReadinessNotice[\s\S]*Online rent collection/);
  assert.match(text, /\{rentCanInvoke && \([\s\S]*What is this property's primary bank account\?[\s\S]*Add new bank account/);
  assert.match(text, /if \(!rentCanInvoke\) return;\s*setShowStripeOnboarding\(true\);/);
});

test('primary creation does not silently finish with no property and uses a defined single-unit selector', async () => {
  const text = await source(propertyAddWorkflowPath);
  assert.match(text, /if \(!created\?\.id\) throw new Error/);
  assert.match(text, /if \(\['singleFamily', 'townhouse', 'condominium'\]\.includes\(values\.propertyType\)\) \{/);
  assert.doesNotMatch(text, /if \(isSingleFamilyType\)/);
  assert.match(text, /if \(!updated\) throw new Error/);
  assert.match(text, /initial units could not be updated\. Review the property before retrying/);
  assert.match(text, /error\?\.response\?\.data\?\.message \|\| error\?\.message/);
  const propertyAction = await source('../../store/property/property.action.js');
  const unitAction = await source('../../store/unit/unit.action.js');
  assert.match(propertyAction.slice(propertyAction.indexOf('export const addOrUpdateProperty'), propertyAction.indexOf('let _latestPropertiesRequestId')), /ADD_PROPERTY_FAILED,[\s\S]*throw error;/);
  assert.match(unitAction.slice(unitAction.indexOf('export const addOrUpdateUnit'), unitAction.indexOf('export const getUnits')), /ADD_UNIT_FAILED,[\s\S]*throw error;/);
});
