import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const setup = readFileSync(new URL('./short-stay-setup.jsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../../api/shortStay.js', import.meta.url), 'utf8');
const guest = readFileSync(new URL('../public/stay.jsx', import.meta.url), 'utf8');

test('owner can configure weekend and length-of-stay pricing with clear priorities', () => {
  for (const label of ['Weekend nightly rate', 'Weekly discount (%)', 'Monthly discount (%)', 'Friday and Saturday', '7 or more nights', '28 or more nights'])
    assert.ok(setup.includes(label), `Missing ${label}`);
  assert.match(setup, /field\('weekendNightlyRate'/);
  assert.match(setup, /field\('weeklyDiscountPercent'/);
  assert.match(setup, /field\('monthlyDiscountPercent'/);
  assert.match(setup, /date override.*weekend.*base/i);
});

test('range prices have a validated exclusive checkout date and are sent through the range endpoint', () => {
  assert.match(api, /saveRateRange:.*axios\.put\(`\$\{unitUrl\(unitId\)\}\/calendar\/rates\/range`, range\)/);
  assert.match(setup, /rangeRatePayload\(rangeStart, rangeEnd, rangeRate\)/);
  assert.match(setup, /shortStayAPI\.saveRateRange\(unitId,/);
  assert.match(setup, /366 nights/);
  assert.match(setup, /exclusive/);
  assert.match(setup, /shortStayAPI\.removeRate\(unitId, night\.date\)/);
});

test('guest estimate displays server discount in the breakdown without implying a reservation', () => {
  assert.match(guest, /quote\.discountCents/);
  assert.match(guest, /Stay discount/);
  assert.match(guest, /Advisory estimate only/);
});
