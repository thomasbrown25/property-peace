import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canManuallyManagePayment,
  classifyPaymentStatus,
  getTenantPaymentSubmissionCopy,
  isBalanceCreditingPayment
} from './paymentSafety.js';

test('missing and unknown payment statuses fail closed and require review', () => {
  for (const payment of [{}, { status: null }, { status: '' }, { status: 'provider_mystery' }]) {
    assert.equal(isBalanceCreditingPayment(payment), false);
    assert.deepEqual(classifyPaymentStatus(payment), {
      status: 'needs-review',
      label: 'Needs review',
      creditsRent: false,
      retryable: false
    });
  }
});

test('only explicit Completed and Paid statuses credit rent', () => {
  for (const status of ['Completed', 'completed', 'Paid', 'paid']) {
    assert.equal(isBalanceCreditingPayment({ status }), true);
    assert.equal(classifyPaymentStatus({ status }).creditsRent, true);
  }

  for (const status of ['Created', 'Processing', 'Failed', 'Canceled', 'Succeeded', 'Transferred']) {
    assert.equal(isBalanceCreditingPayment({ status }), false);
    assert.equal(classifyPaymentStatus({ status }).creditsRent, false);
  }
});

test('tenant submission copy never presents browser confirmation as final settlement', () => {
  assert.deepEqual(getTenantPaymentSubmissionCopy({ status: 'succeeded' }), {
    title: 'Payment confirmation received',
    message: 'Your payment was confirmed by the payment provider. Property Peace is verifying and applying it to your rent balance. Check Payment History for the final status.',
    tone: 'info'
  });

  assert.deepEqual(getTenantPaymentSubmissionCopy({ status: 'processing' }), {
    title: 'Payment processing',
    message: 'Your bank payment was submitted and may take several business days to finish. Your rent balance updates only after Property Peace receives final confirmation. Check Payment History for updates.',
    tone: 'info'
  });
});

test('provider-recorded payments cannot be manually edited or deleted', () => {
  assert.equal(canManuallyManagePayment({ type: 'payment', stripePaymentIntentId: 'pi_123' }), false);
  assert.equal(canManuallyManagePayment({ type: 'payment', StripeChargeId: 'ch_123' }), false);
  assert.equal(canManuallyManagePayment({ type: 'payment', method: 'Online Payment' }), false);
  assert.equal(canManuallyManagePayment({ type: 'payment', method: 'Manual Entry' }), true);
  assert.equal(canManuallyManagePayment({ type: 'deposit', method: 'Deposit' }), false);
});
