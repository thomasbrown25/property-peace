// Only an authoritative fee row may start a charge-scoped checkout. Never substitute rent.
export function feeCheckoutSelection(charge) {
  if (String(charge?.type || '').toLowerCase() !== 'fee' || !/^fee:[1-9]\d*$/.test(String(charge?.chargeId || ''))) return null;
  const remainingCents = Math.round(Number(charge.remaining) * 100);
  if (!Number.isFinite(remainingCents) || remainingCents < 50) return null;
  return { chargeId: charge.chargeId, title: charge.title || 'Fee', remainingCents };
}

export function feeAmountCents(value, remainingCents) {
  const text = String(value);
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= 50 && cents <= remainingCents ? cents : null;
}

export function feeIntentPayload({ leaseId, selection, amount, operationId }) {
  if (!selection || !/^fee:[1-9]\d*$/.test(String(selection.chargeId)) || !operationId || !Number.isSafeInteger(Number(leaseId)) || Number(leaseId) <= 0) return null;
  const cents = feeAmountCents(amount, selection.remainingCents);
  if (cents === null) return null;
  return { leaseId, chargeId: selection.chargeId, amount: cents / 100, operationId, description: `Payment for ${selection.title}` };
}

export function feeAttempt(leaseId, chargeId, storage, createId) {
  const key = `fee-checkout:${leaseId}:${chargeId}`;
  try {
    const stored = JSON.parse(storage.getItem(key));
    if (stored?.operationId && (stored.amount === null || feeAmountCents(stored.amount, Number.MAX_SAFE_INTEGER) !== null)) return stored;
  } catch { /* Storage may be unavailable; keep the in-memory operation for this checkout. */ }
  return { operationId: createId(), amount: null };
}

export function feeSubmissionCopy(status) {
  return status === 'processing'
    ? { title: 'Fee payment processing', message: 'Your payment was submitted. Your fee balance updates only after final confirmation from Stripe. Check the charge ledger for updates.' }
    : { title: 'Fee payment submitted', message: 'Stripe confirmed your submission. Your fee balance updates only after the signed webhook confirms and applies the payment. Check the charge ledger for updates.' };
}
