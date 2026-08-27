import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RENT_PAYMENT_ACCESS_STATUS,
  RENT_PAYMENT_BLOCKER,
  getRentPaymentAccessPresentation,
  loadRentPaymentAccessState
} from './rentPaymentAccess.js';

const configureAllowed = { allowed: true, providerEnabled: true, blockers: [] };
const payAllowed = { allowed: true, providerEnabled: true, connectedPayeeApproved: true, connectedPayeeReady: true, blockers: [] };

test('not-requested access does not load setup readiness or surface its failures', async () => {
  let readinessCalls = 0;
  const failIfCalled = async () => {
    readinessCalls += 1;
    throw new Error('setup readiness should not load before approval');
  };

  const result = await loadRentPaymentAccessState({
    signal: new AbortController().signal,
    loadAccess: async () => ({ data: { organizationId: 701, status: 'NotRequested' } }),
    loadFeatureReadiness: failIfCalled,
    loadActionReadiness: failIfCalled,
    selectFeatureReadiness: () => null
  });

  assert.deepEqual(result, {
    access: { organizationId: 701, status: 'NotRequested' },
    readiness: null,
    configureReadiness: null,
    payReadiness: null
  });
  assert.equal(readinessCalls, 0);
});

test('a genuine access load error cannot masquerade as not requested', () => {
  assert.deepEqual(
    getRentPaymentAccessPresentation({ error: 'Unable to load online rent payment access.' }),
    {
      status: 'unavailable',
      title: 'Online rent payments temporarily unavailable',
      message: 'Online rent payment access could not be loaded. Retry to check your organization status.',
      actionLabel: 'Refresh status',
      canRequest: false,
      canConfigure: false,
      canPay: false
    }
  );
});

test('rent payment access presentation applies the approved access and readiness priority order', () => {
  assert.deepEqual(
    getRentPaymentAccessPresentation({ access: null, configureReadiness: configureAllowed, payReadiness: payAllowed }),
    {
      status: 'not-requested',
      title: 'Request online rent payments',
      message: 'Request approval to begin payment setup for your organization.',
      actionLabel: 'Request online rent payments',
      canRequest: true,
      canConfigure: false,
      canPay: false
    }
  );

  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.pending }, configureReadiness: configureAllowed, payReadiness: payAllowed }).status, 'pending');
  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.approved }, configureReadiness: configureAllowed, payReadiness: { ...payAllowed, allowed: false, connectedPayeeExists: true, connectedPayeeReady: false } }).status, 'under-review');
  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.approved }, configureReadiness: configureAllowed, payReadiness: payAllowed }).status, 'ready');
});

test('rent payment access presentation never exposes internal review notes and fails closed when unavailable', () => {
  const rejected = getRentPaymentAccessPresentation({
    access: { status: RENT_PAYMENT_ACCESS_STATUS.rejected, decisionReason: 'Please update your business information.', internalNotes: 'Do not expose this.' },
    configureReadiness: configureAllowed,
    payReadiness: payAllowed
  });
  assert.equal(rejected.status, 'rejected');
  assert.match(rejected.message, /Please update your business information/);
  assert.doesNotMatch(JSON.stringify(rejected), /internal|Do not expose/i);
  assert.equal(rejected.canRequest, true);

  const unavailable = getRentPaymentAccessPresentation({
    access: { status: RENT_PAYMENT_ACCESS_STATUS.approved },
    configureReadiness: { allowed: false, providerEnabled: false, blockers: [RENT_PAYMENT_BLOCKER.providerDisabled] },
    payReadiness: payAllowed
  });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.canConfigure, false);
  assert.equal(unavailable.canPay, false);
});

test('rent payment access presentation covers every required status and preserves priority', () => {
  const unavailable = { providerEnabled: false, blockers: [RENT_PAYMENT_BLOCKER.providerDisabled] };
  const blockedPay = { allowed: false, providerEnabled: true, connectedPayeeExists: true, blockers: [RENT_PAYMENT_BLOCKER.connectedPayeeUnderReview] };

  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.pending }, configureReadiness: configureAllowed, payReadiness: payAllowed }).status, 'pending');
  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.suspended, decisionReason: 'Account review required.' }, configureReadiness: configureAllowed, payReadiness: payAllowed }).status, 'suspended');
  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.approved }, configureReadiness: configureAllowed, payReadiness: { ...blockedPay, connectedPayeeExists: false } }).status, 'approved-onboarding');
  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.approved }, configureReadiness: configureAllowed, payReadiness: blockedPay }).status, 'under-review');
  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.approved }, configureReadiness: configureAllowed, payReadiness: payAllowed }).status, 'ready');
  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.approved }, aggregateReadiness: { globalGateEnabled: false }, configureReadiness: configureAllowed, payReadiness: payAllowed }).status, 'unavailable');
  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.suspended }, configureReadiness: unavailable, payReadiness: payAllowed }).status, 'unavailable');
});