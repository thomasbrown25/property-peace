import test from 'node:test';
import assert from 'node:assert/strict';

import { FEATURE_KEYS, getFeaturePresentation } from './featureReadiness.js';

const ready = {
  feature: FEATURE_KEYS.tenantScreening,
  state: 'Available',
  canInvoke: true,
  planEntitled: true,
  globalGateEnabled: true,
  organizationReady: true,
  providerConfigured: true,
  userAuthorized: true,
  blockers: []
};

test('available and pilot features can be invoked only when the API says so', () => {
  assert.deepEqual(getFeaturePresentation(ready), {
    status: 'available', title: 'Available', message: 'This feature is ready to use.', severity: 'success', canInvoke: true, action: null
  });
  assert.equal(getFeaturePresentation({ ...ready, state: 'available' }).status, 'available');
  assert.equal(getFeaturePresentation({ ...ready, state: 'pilot' }).status, 'pilot');
  assert.equal(getFeaturePresentation({ ...ready, canInvoke: false }).canInvoke, false);
});

test('plan entitlement is presented as an upgrade, not setup', () => {
  const value = getFeaturePresentation({ ...ready, canInvoke: false, planEntitled: false, blockers: ['PlanEntitlement'] });
  assert.equal(value.status, 'upgrade');
  assert.equal(value.action, 'upgrade');
  assert.match(value.message, /plan/i);
});

test('provider and organization blockers are presented as setup requirements', () => {
  for (const blocker of ['ProviderConfiguration', 'OrganizationReadiness']) {
    const value = getFeaturePresentation({ ...ready, state: 'ConfigurationRequired', canInvoke: false, blockers: [blocker] });
    assert.equal(value.status, 'setup');
    assert.equal(value.action, 'setup');
  }
});

test('lifecycle states remain truthful', () => {
  assert.equal(getFeaturePresentation({ ...ready, state: 'ComingSoon', canInvoke: false }).status, 'coming-soon');
  assert.equal(getFeaturePresentation({ ...ready, state: 'Suspended', canInvoke: false }).status, 'suspended');
  assert.equal(getFeaturePresentation({ ...ready, state: 'Unavailable', canInvoke: false }).status, 'unavailable');
});

test('loading, fetch failure, malformed and missing records fail closed', () => {
  for (const context of [{ isLoading: true }, { error: new Error('nope') }, {}]) {
    assert.equal(getFeaturePresentation(undefined, context).canInvoke, false);
  }
  assert.equal(getFeaturePresentation({ ...ready, canInvoke: 'yes' }).canInvoke, false);
  assert.equal(getFeaturePresentation(undefined, { error: new Error('nope') }).status, 'error');
});
