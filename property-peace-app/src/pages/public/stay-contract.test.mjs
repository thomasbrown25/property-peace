import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dayNumber, moneyFromCents, validateStay, publicStayError } from './stay-contract.mjs';

const root = new URL('../../', import.meta.url);
const source = (path) => readFileSync(new URL(path, root), 'utf8');

test('property-local calendar dates do not depend on browser today or timezone', () => {
  assert.equal(dayNumber('2026-03-08') + 1, dayNumber('2026-03-09'));
  assert.equal(dayNumber('2026-02-30'), null);
  assert.equal(dayNumber('2026-3-08'), null);
  const listing = { minimumNights: 2, maxGuests: 4 };
  assert.equal(validateStay({ checkIn: '2026-03-08', checkOut: '2026-03-10', guests: '4' }, listing), null);
  assert.match(validateStay({ checkIn: '2026-03-08', checkOut: '2026-03-09', guests: 1 }, listing), /at least 2/);
  assert.match(validateStay({ checkIn: '2026-03-08', checkOut: '2026-04-09', guests: 1 }, listing), /1 to 30/);
  assert.match(validateStay({ checkIn: '2026-03-08', checkOut: '2026-03-10', guests: 5 }, listing), /1 to 4/);
});

test('only server-provided integer cents produce money; server error messages surface', () => {
  assert.equal(moneyFromCents(0), '$0.00');
  assert.equal(moneyFromCents(12345), '$123.45');
  assert.equal(moneyFromCents(null), null);
  assert.equal(moneyFromCents(-1), null);
  assert.equal(publicStayError({ message: 'Use yyyy-MM-dd property-local dates' }, 'fallback'), 'Use yyyy-MM-dd property-local dates');
});

test('anonymous route, read-only request shape, and fail-closed checkout boundary', () => {
  const routes = source('routes/MainRoutes.jsx');
  const api = source('api/publicStay.js');
  const axios = source('utils/axios.js');
  const page = source('pages/public/stay.jsx');
  assert.match(routes, /path: 'stay\/:unitId',[\s\S]*?element: <PublicStay \/>/);
  assert.ok(routes.indexOf("path: 'stay/:unitId'") < routes.indexOf("path: '*',"));
  assert.match(api, /withCredentials: false/);
  assert.match(api, /params: \{ checkIn: dates\.checkIn, checkOut: dates\.checkOut, guests: Number\(dates\.guests\) \}/);
  assert.doesNotMatch(api, /axios\.post|totalCents:|price:/);
  assert.match(axios, /if \(isPublicStayEndpoint\(config\.url\)\) \{[\s\S]*?removeInheritedAuthContext\(config\.headers\);[\s\S]*?return config;/);
  assert.match(axios, /skipAuthRedirect === true \|\| isPublicStayEndpoint/);
  assert.match(page, /bookingRequestsEnabled === true && quote\?\.status === 'preflight_available'/);
  assert.match(page, /\(canContinue \|\| validReservationCode\(reservationCode\)\) && <StayCheckout/);
  assert.match(page, /!canContinue && !validReservationCode\(reservationCode\)/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|<img|axios\.post/);
});
