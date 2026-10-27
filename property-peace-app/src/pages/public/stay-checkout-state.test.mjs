import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canStartPayment, getOrCreateHoldKey, guestCheckoutError, receiptMatches, shouldPollStatus, statusMatches, stayTuple, validReservationCode } from './stay-checkout-state.mjs';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const code = 'a'.repeat(32);
const dates = { checkIn: '2026-11-01', checkOut: '2026-11-04', guests: '2' };

test('hold idempotency is persisted before send and scoped to the exact unit/dates/guests', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  let generated = 0;
  const create = () => { generated++; return '01234567-89ab-4cde-8fab-0123456789ab'; };
  const tuple = stayTuple(42, dates);
  assert.equal(getOrCreateHoldKey(storage, tuple, create), getOrCreateHoldKey(storage, tuple, create));
  assert.equal(generated, 1);
  getOrCreateHoldKey(storage, stayTuple(43, dates), create);
  getOrCreateHoldKey(storage, stayTuple(42, { ...dates, guests: '3' }), create);
  assert.equal(generated, 3);
});

test('receipt must match original inputs; only server statuses indicate confirmation', () => {
  assert.equal(receiptMatches({ code, ...dates, guests: 2, totalCents: 10000, expiresAtUtc: '2099-01-01T00:00:00Z' }, dates), true);
  assert.equal(receiptMatches({ code, ...dates, guests: 3, totalCents: 10000, expiresAtUtc: '2099-01-01T00:00:00Z' }, dates), false);
  assert.equal(validReservationCode('not-a-code'), false);
  assert.equal(statusMatches({ publicCode: code, status: 'Confirmed' }, code), true);
  assert.equal(statusMatches({ publicCode: 'b'.repeat(32), status: 'Confirmed' }, code), false);
  assert.equal(statusMatches({ publicCode: code, status: 'Succeeded' }, code), false);
  assert.equal(canStartPayment('PendingPayment', '2099-01-01T00:00:00Z'), true);
  assert.equal(canStartPayment('Processing', '2099-01-01T00:00:00Z'), false);
  assert.equal(canStartPayment('Held', '2000-01-01T00:00:00Z'), false);
  assert.equal(shouldPollStatus('Processing'), true);
  assert.equal(shouldPollStatus('Confirmed'), false);
});

test('auth failures explain existing-account requirement, and checkout uses connected-account context', () => {
  assert.match(guestCheckoutError({ status: 401 }, 'fallback'), /existing Property Peace account/);
  assert.match(guestCheckoutError({ reason: 'feature_disabled' }, 'fallback'), /not enabled/);
  const page = source('stay.jsx');
  const checkout = source('StayCheckout.jsx');
  const api = readFileSync(new URL('../../api/stayCheckout.js', import.meta.url), 'utf8');
  assert.match(page, /bookingRequestsEnabled === true && quote\?\.status === 'preflight_available'/);
  assert.match(checkout, /loadStripe\(result.publishableKey, \{ stripeAccount: result.connectedAccountId \}\)/);
  assert.match(checkout, /redirect: 'if_required'/);
  assert.match(checkout, /status\?\.status === 'Confirmed'/);
  assert.match(api, /skipAuthRedirect: true/);
  assert.doesNotMatch(api, /withCredentials: false|totalCents|clientSecret/);
});
