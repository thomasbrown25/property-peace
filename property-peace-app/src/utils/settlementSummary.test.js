import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSettlementPresentation, normalizeSettlementSummary, settlementStateLabel } from './settlementSummary.js';

const zeroSummary = {
  processingAmount: 0,
  processingCount: 0,
  heldAmount: 0,
  heldCount: 0,
  availableAmount: 0,
  availableCount: 0,
  transferredAmount: 0,
  transferredCount: 0,
  blockedAmount: 0,
  blockedCount: 0,
  returnedAmount: 0,
  returnedCount: 0,
  reconciliationPendingAmount: 0,
  reconciliationPendingCount: 0,
  recoveryFailedAmount: 0,
  recoveryFailedCount: 0
};

test('normalizes each truthful camelCase settlement state without recombining them', () => {
  assert.deepEqual(
    normalizeSettlementSummary({
      settlementProcessing: 1.01,
      settlementProcessingCount: 1,
      settlementHeld: 2.02,
      settlementHeldCount: 2,
      settlementAvailable: 3.03,
      settlementAvailableCount: 3,
      settlementTransferred: 4.04,
      settlementTransferredCount: 4,
      settlementBlocked: 5.05,
      settlementBlockedCount: 5,
      settlementReturned: 6.06,
      settlementReturnedCount: 6,
      settlementReconciliationPending: 7.07,
      settlementReconciliationPendingCount: 7,
      settlementRecoveryFailed: 8.08,
      settlementRecoveryFailedCount: 8
    }),
    {
      processingAmount: 1.01,
      processingCount: 1,
      heldAmount: 2.02,
      heldCount: 2,
      availableAmount: 3.03,
      availableCount: 3,
      transferredAmount: 4.04,
      transferredCount: 4,
      blockedAmount: 5.05,
      blockedCount: 5,
      returnedAmount: 6.06,
      returnedCount: 6,
      reconciliationPendingAmount: 7.07,
      reconciliationPendingCount: 7,
      recoveryFailedAmount: 8.08,
      recoveryFailedCount: 8
    }
  );
});

test('normalizes PascalCase fields and safely coerces absent or invalid values to zero', () => {
  const normalized = normalizeSettlementSummary({
    SettlementHeld: '4.25',
    SettlementHeldCount: '1',
    SettlementTransferred: null,
    SettlementTransferredCount: -2,
    SettlementBlocked: 'not an amount'
  });

  assert.deepEqual(normalized, { ...zeroSummary, heldAmount: 4.25, heldCount: 1 });
  assert.deepEqual(normalizeSettlementSummary(), zeroSummary);
});

test('builds truthful labels and useful zero states for all operational states', () => {
  const presentation = buildSettlementPresentation({});

  assert.equal(presentation.heading, 'Landlord settlement');
  assert.match(presentation.explanation, /tenant payment/i);
  assert.match(presentation.explanation, /does not mean/i);
  assert.deepEqual(
    presentation.states.map(({ key, label, countLabel }) => ({ key, label, countLabel })),
    [
      { key: 'processing', label: 'Payment processing', countLabel: '0 payments' },
      { key: 'held', label: 'Hold period', countLabel: '0 payments' },
      { key: 'available', label: 'Available to transfer', countLabel: '0 payments' },
      { key: 'transferred', label: 'Transferred to Stripe', countLabel: '0 payments' },
      { key: 'blocked', label: 'Transfer blocked', countLabel: '0 payments' },
      { key: 'returned', label: 'Returned, refunded, or disputed', countLabel: '0 payments' },
      { key: 'reconciliationPending', label: 'Reconciliation pending', countLabel: '0 payments' },
      { key: 'recoveryFailed', label: 'Recovery failed', countLabel: '0 payments' }
    ]
  );
  assert.match(presentation.states[3].description, /bank payout timing can differ/i);
});

test('uses singular/plural counts and fail-closed public labels without leaking internal errors', () => {
  const states = buildSettlementPresentation({ SettlementProcessingCount: 1, settlementTransferredCount: 2 }).states;
  assert.equal(states[0].countLabel, '1 payment');
  assert.equal(states[3].countLabel, '2 payments');

  assert.equal(settlementStateLabel('Created'), 'Payment processing');
  assert.equal(settlementStateLabel('Processing'), 'Payment processing');
  assert.equal(settlementStateLabel('Held'), 'Hold period');
  assert.equal(settlementStateLabel('TransferPending'), 'Available to transfer');
  assert.equal(settlementStateLabel('Transferred'), 'Transferred to Stripe');
  assert.equal(settlementStateLabel('Blocked'), 'Transfer blocked');
  assert.equal(settlementStateLabel('ReversalPending'), 'Returned, refunded, or disputed');
  assert.equal(settlementStateLabel('Reversed'), 'Returned, refunded, or disputed');
  assert.equal(settlementStateLabel('TransferReconciliationPending'), 'Reconciliation pending');
  assert.equal(settlementStateLabel('RecoveryFailed'), 'Recovery failed');
  assert.equal(settlementStateLabel('provider_secret_failure_detail'), 'Unknown');
});
