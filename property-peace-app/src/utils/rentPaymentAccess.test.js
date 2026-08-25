import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RENT_PAYMENT_ACCESS_STATUS,
  RENT_PAYMENT_BLOCKER,
  getRentPaymentAccessPresentation
} from './rentPaymentAccess.js';

const configureAllowed = { allowed: true, providerEnabled: true, blockers: [] };
const payAllowed = { allowed: true, providerEnabled: true, connectedPayeeApproved: true, connectedPayeeReady: true, blockers: [] };

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
  assert.equal(getRentPaymentAccessPresentation({ access: { status: RENT_PAYMENT_ACCESS_STATUS.approved }, configureReadiness: configureAllowed, payReadiness: { ...payAllowed, allowed: false, connectedPayeeReady: false } }).status, 'under-review');
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
