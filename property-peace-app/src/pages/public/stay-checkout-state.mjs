export const validReservationCode = (code) => typeof code === 'string' && /^[a-f0-9]{32}$/i.test(code);
export const stayTuple = (unitId, dates) => JSON.stringify([String(unitId), dates.checkIn, dates.checkOut, Number(dates.guests)]);
export const holdKeyStorageName = (tuple) => `pp:stay:hold:${tuple}`;
export const getOrCreateHoldKey = (storage, tuple, randomUUID) => {
  const name = holdKeyStorageName(tuple);
  const existing = storage.getItem(name);
  if (existing && /^[a-f0-9-]{36}$/i.test(existing)) return existing;
  const key = randomUUID();
  storage.setItem(name, key); // Persist BEFORE POST, so an uncertain network outcome retries the same operation.
  return key;
};
export const receiptMatches = (receipt, dates) =>
  validReservationCode(receipt?.code) && receipt.checkIn === dates.checkIn &&
  receipt.checkOut === dates.checkOut && receipt.guests === Number(dates.guests) &&
  Number.isSafeInteger(receipt.totalCents) && receipt.totalCents >= 0 &&
  Number.isFinite(Date.parse(receipt.expiresAtUtc));
export const statusMatches = (status, code) =>
  validReservationCode(code) && status?.publicCode?.toLowerCase() === code.toLowerCase() &&
  ['Held', 'PendingPayment', 'Processing', 'Confirmed', 'RefundRequired', 'Failed', 'Expired', 'Refunded', 'Disputed'].includes(status?.status);
export const canStartPayment = (status, expiry) =>
  ['Held', 'PendingPayment'].includes(status) && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) > Date.now();
export const shouldPollStatus = (status) => ['Held', 'PendingPayment', 'Processing'].includes(status);
export const guestCheckoutError = (error, fallback) => {
  if (error?.status === 401 || error?.reason === 'authentication_required') return 'Sign in with an existing Property Peace account to place a hold or view your reservation. Guest signup is not available here yet.';
  if (error?.status === 403) return 'This account cannot book this stay. Sign in with an eligible guest account.';
  if (error?.reason === 'feature_disabled') return 'Checkout is not enabled for this stay yet. No payment was taken.';
  if (error?.status === 409) return 'This hold or availability changed. Check your reservation status or select dates again.';
  return fallback;
};
