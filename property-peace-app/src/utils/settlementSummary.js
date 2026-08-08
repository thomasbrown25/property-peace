const PUBLIC_STATE_LABELS = Object.freeze({
  Created: 'Payment processing',
  Processing: 'Payment processing',
  Held: 'Hold period',
  TransferPending: 'Available to transfer',
  Transferred: 'Transferred to Stripe',
  Blocked: 'Transfer blocked',
  ReversalPending: 'Returned, refunded, or disputed',
  Reversed: 'Returned, refunded, or disputed',
  TransferReconciliationPending: 'Reconciliation pending',
  RecoveryFailed: 'Recovery failed'
});

const readField = (summary, camelCaseName, pascalCaseName) =>
  Object.prototype.hasOwnProperty.call(summary, camelCaseName) ? summary[camelCaseName] : summary[pascalCaseName];

const nonNegativeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const nonNegativeCount = (value) => Math.floor(nonNegativeNumber(value));
const paymentCountLabel = (count) => `${count} ${count === 1 ? 'payment' : 'payments'}`;

const readState = (summary, name) => ({
  amount: nonNegativeNumber(readField(summary, `settlement${name}`, `Settlement${name}`)),
  count: nonNegativeCount(readField(summary, `settlement${name}Count`, `Settlement${name}Count`))
});

export function normalizeSettlementSummary(summary = {}) {
  const safeSummary = summary && typeof summary === 'object' ? summary : {};
  const processing = readState(safeSummary, 'Processing');
  const held = readState(safeSummary, 'Held');
  const available = readState(safeSummary, 'Available');
  const transferred = readState(safeSummary, 'Transferred');
  const blocked = readState(safeSummary, 'Blocked');
  const returned = readState(safeSummary, 'Returned');
  const reconciliationPending = readState(safeSummary, 'ReconciliationPending');
  const recoveryFailed = readState(safeSummary, 'RecoveryFailed');

  return {
    processingAmount: processing.amount,
    processingCount: processing.count,
    heldAmount: held.amount,
    heldCount: held.count,
    availableAmount: available.amount,
    availableCount: available.count,
    transferredAmount: transferred.amount,
    transferredCount: transferred.count,
    blockedAmount: blocked.amount,
    blockedCount: blocked.count,
    returnedAmount: returned.amount,
    returnedCount: returned.count,
    reconciliationPendingAmount: reconciliationPending.amount,
    reconciliationPendingCount: reconciliationPending.count,
    recoveryFailedAmount: recoveryFailed.amount,
    recoveryFailedCount: recoveryFailed.count
  };
}

export function settlementStateLabel(status) {
  return PUBLIC_STATE_LABELS[status] || 'Unknown';
}

const state = (key, label, amount, count, zeroLabel, description) => ({
  key,
  label,
  amount,
  count,
  countLabel: paymentCountLabel(count),
  zeroLabel,
  description
});

export function buildSettlementPresentation(summary) {
  const normalized = normalizeSettlementSummary(summary);

  return {
    heading: 'Landlord settlement',
    explanation:
      'Tenant payment and landlord settlement are separate. A payment shown as collected means the tenant payment was recorded; it does not mean the funds have reached your bank.',
    states: [
      state('processing', 'Payment processing', normalized.processingAmount, normalized.processingCount,
        'No payments processing', 'Card confirmation or bank settlement is still pending. These funds are not available to transfer.'),
      state('held', 'Hold period', normalized.heldAmount, normalized.heldCount,
        'No funds in a hold period', 'Confirmed payments still inside Property Peace’s card or ACH safety hold.'),
      state('available', 'Available to transfer', normalized.availableAmount, normalized.availableCount,
        'No funds available to transfer', 'The safety hold has ended or a transfer is queued, but the transfer is not yet confirmed.'),
      state('transferred', 'Transferred to Stripe', normalized.transferredAmount, normalized.transferredCount,
        'No transfers yet', 'Funds sent to your connected Stripe account. Bank payout timing can differ.'),
      state('blocked', 'Transfer blocked', normalized.blockedAmount, normalized.blockedCount,
        'No blocked transfers', 'A safety, account, authorization, or capability check is preventing transfer.'),
      state('returned', 'Returned, refunded, or disputed', normalized.returnedAmount, normalized.returnedCount,
        'No returned funds', 'Funds were refunded, disputed, returned by the bank, or reversed after collection.'),
      state('reconciliationPending', 'Reconciliation pending', normalized.reconciliationPendingAmount,
        normalized.reconciliationPendingCount, 'No reconciliation pending',
        'Provider state is not yet conclusive. Do not treat these funds as settled.'),
      state('recoveryFailed', 'Recovery failed', normalized.recoveryFailedAmount, normalized.recoveryFailedCount,
        'No failed recoveries', 'An automatic reversal or recovery could not be completed and needs manual review.')
    ]
  };
}
